import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { supabase } from './supabase';

type NotificationsModule = typeof import('expo-notifications');

const DAILY_CHECKIN_ID = 'deva-daily-checkin';
const CRISIS_FOLLOWUP_ID = (day: number) => `deva-crisis-${day}`;
const APPOINTMENT_ID = (id: string) => `deva-appointment-${id}`;
const CRISIS_FOLLOWUP_DAYS = [2, 5, 9, 14, 21, 30];

/**
 * Expo Go, SDK 53 ile uzak (push) bildirim desteğini kaldırdı. `expo-notifications`
 * import edildiği anda push token dinleyicisini kurup bu ortamda hata fırlatıyor.
 * DEVA yalnızca yerel bildirim kullandığı için Expo Go'da modül hiç yüklenmiyor;
 * bildirimler yalnızca gerçek uygulama derlemesinde (APK) çalışıyor.
 */
export const isExpoGo = Constants.executionEnvironment === 'storeClient';

const native = isExpoGo
  ? null
  : // eslint-disable-next-line @typescript-eslint/no-require-imports -- koşullu yükleme: Expo Go'da modül hiç çalıştırılmamalı
    (require('expo-notifications') as NotificationsModule);

export interface ReminderAppointment {
  id: string;
  title: string;
  starts_at: string;
  remind_at: string | null;
  remind_enabled: boolean;
}

/** Bildirim izni ister; reddedilse de uygulama akışı devam eder. */
export async function requestNotificationPermission(): Promise<boolean> {
  if (!native) return false;

  const current = await native.getPermissionsAsync();
  if (current.granted) return true;
  if (!current.canAskAgain) return false;
  const next = await native.requestPermissionsAsync();
  return next.granted;
}

export async function configureNotifications(): Promise<void> {
  if (!native) return;

  native.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  });

  if (Platform.OS === 'android') {
    await native.setNotificationChannelAsync('deva-default', {
      name: 'DEVA',
      importance: native.AndroidImportance.DEFAULT,
    });
  }
}

/** Bildirime dokunulduğunda verilen adresi döndürür (Expo Go'da hiç olmaz). */
export function addNotificationResponseListener(
  onUrl: (url: string) => void,
): { remove: () => void } {
  if (!native) return { remove: () => undefined };

  return native.addNotificationResponseReceivedListener((response) => {
    const url = response.notification.request.content.data?.url;
    if (typeof url === 'string') onUrl(url);
  });
}

export async function cancelAllNotifications(): Promise<void> {
  await native?.cancelAllScheduledNotificationsAsync();
}

/** `HH:MM` biçimindeki saati bir sonraki geçerli ana çevirir. */
export function nextDailyOccurrence(time: string, from: Date = new Date()): Date {
  const [hourPart, minutePart] = time.split(':');
  const hour = Number.parseInt(hourPart ?? '20', 10);
  const minute = Number.parseInt(minutePart ?? '0', 10);

  const next = new Date(from);
  next.setHours(Number.isNaN(hour) ? 20 : hour, Number.isNaN(minute) ? 0 : minute, 0, 0);
  if (next.getTime() <= from.getTime()) next.setDate(next.getDate() + 1);
  return next;
}

export async function cancelAppointmentReminder(id: string): Promise<void> {
  await native?.cancelScheduledNotificationAsync(APPOINTMENT_ID(id));
}

export async function scheduleAppointmentReminder(
  appointment: ReminderAppointment,
): Promise<void> {
  if (!native) return;

  await cancelAppointmentReminder(appointment.id);
  if (!appointment.remind_enabled) return;

  const remindAt = appointment.remind_at
    ? new Date(appointment.remind_at)
    : new Date(new Date(appointment.starts_at).getTime() - 60 * 60 * 1000);

  if (remindAt.getTime() <= Date.now()) return;

  await native.scheduleNotificationAsync({
    identifier: APPOINTMENT_ID(appointment.id),
    content: {
      title: 'Randevun yaklaşıyor',
      body: `1 saat sonra: ${appointment.title}`,
      data: { url: '/appointments' },
    },
    trigger: { type: native.SchedulableTriggerInputTypes.DATE, date: remindAt },
  });
}

/**
 * Tüm yerel bildirimleri DB'deki ayarlara göre yeniden kurar.
 * Önce hepsini iptal eder; böylece ayrıldıktan sonra geri gelindiğinde
 * ikinci bir kopya oluşmaz.
 */
export async function syncAllNotifications(userId: string): Promise<void> {
  if (!native) return;

  await native.cancelAllScheduledNotificationsAsync();

  const [{ data: settings }, { data: crisisEvents }, { data: appointments }] =
    await Promise.all([
      supabase
        .from('user_settings')
        .select('daily_checkin_enabled, daily_checkin_time, post_crisis_followup_enabled')
        .eq('user_id', userId)
        .maybeSingle(),
      supabase
        .from('crisis_events')
        .select('level, created_at')
        .eq('user_id', userId)
        .in('level', ['high', 'critical'])
        .gte('created_at', new Date(Date.now() - 30 * 86_400_000).toISOString()),
      supabase
        .from('appointments')
        .select('id, title, starts_at, remind_at, remind_enabled')
        .eq('user_id', userId)
        .eq('remind_enabled', true)
        .gte('starts_at', new Date().toISOString()),
    ]);

  if (!settings) return;

  if (settings.daily_checkin_enabled) {
    await native.scheduleNotificationAsync({
      identifier: DAILY_CHECKIN_ID,
      content: { title: 'DEVA', body: 'Nasılsın bugün?', data: { url: '/' } },
      trigger: {
        type: native.SchedulableTriggerInputTypes.DATE,
        date: nextDailyOccurrence(settings.daily_checkin_time ?? '20:00'),
      },
    });
  }

  if (settings.post_crisis_followup_enabled) {
    const latest = (crisisEvents ?? [])
      .map((row) => new Date(row.created_at as string).getTime())
      .sort((a, b) => b - a)[0];

    if (latest !== undefined) {
      for (const dayOffset of CRISIS_FOLLOWUP_DAYS) {
        const date = new Date(latest + dayOffset * 86_400_000);
        if (date.getTime() <= Date.now()) continue;
        await native.scheduleNotificationAsync({
          identifier: CRISIS_FOLLOWUP_ID(dayOffset),
          content: {
            title: 'Nasıl gidiyor?',
            body: 'Ne zaman hazırsan buradayım.',
            data: { url: '/' },
          },
          trigger: { type: native.SchedulableTriggerInputTypes.DATE, date },
        });
      }
    }
  }

  for (const appointment of (appointments ?? []) as ReminderAppointment[]) {
    await scheduleAppointmentReminder(appointment);
  }
}