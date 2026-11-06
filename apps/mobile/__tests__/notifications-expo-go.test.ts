/**
 * Expo Go, SDK 53 ile uzak bildirim desteğini kaldırdı ve `expo-notifications`
 * import edildiği anda hata fırlatıyor. DEVA yalnızca yerel bildirim kullandığı
 * için Expo Go'da modül hiç yüklenmemeli; gerçek uygulama derlemesinde ise
 * tam çalışmalı.
 */

type Settings = {
  daily_checkin_enabled: boolean;
  daily_checkin_time: string;
  post_crisis_followup_enabled: boolean;
};

const mockEnv = { executionEnvironment: 'standalone' };
const mockSettings: Settings = {
  daily_checkin_enabled: true,
  daily_checkin_time: '20:00',
  post_crisis_followup_enabled: true,
};
const mockCrisisEvents: { level: string; created_at: string }[] = [];
const mockAppointments: Record<string, unknown>[] = [];

function loadNotifications() {
  jest.resetModules();

  jest.doMock('expo-constants', () => ({
    executionEnvironment: mockEnv.executionEnvironment,
  }));

  // `from()` zinciri hangi tablonun sorgulandığını `select` argümanından ayırır.
  jest.doMock('../lib/supabase', () => ({
    supabase: {
      from: () => {
        const chain = {
          select: (_columns: string) => chain,
          eq: () => chain,
          in: () => chain,
          gte: () => chain,
          maybeSingle: async () => ({ data: mockSettings, error: null }),
          then: (resolve: (value: unknown) => unknown) =>
            resolve({ data: mockCrisisEvents.length ? mockCrisisEvents : mockAppointments, error: null }),
        };
        return chain;
      },
    },
    PHONE_AUTH_ENABLED: false,
  }));

  return require('../lib/notifications');
}

beforeEach(() => {
  mockEnv.executionEnvironment = 'standalone';
  mockSettings.daily_checkin_enabled = true;
  mockSettings.daily_checkin_time = '20:00';
  mockSettings.post_crisis_followup_enabled = true;
  mockCrisisEvents.length = 0;
  mockAppointments.length = 0;
});

afterEach(() => {
  jest.dontMock('expo-constants');
  jest.dontMock('expo-notifications');
  jest.dontMock('../lib/supabase');
});

describe('Expo Go ortamı', () => {
  it('expo-notifications modülünü hiç yüklemiyor', () => {
    mockEnv.executionEnvironment = 'storeClient';
    jest.doMock('expo-notifications', () => {
      throw new Error('expo-notifications Expo Go içinde yüklenemez');
    });

    const notifications = loadNotifications();

    expect(notifications.isExpoGo).toBe(true);
  });

  it('bildirim API\'lerini güvenle çağırıyor (çökmez)', async () => {
    mockEnv.executionEnvironment = 'storeClient';
    jest.doMock('expo-notifications', () => {
      throw new Error('expo-notifications Expo Go içinde yüklenemez');
    });

    const notifications = loadNotifications();

    await expect(notifications.configureNotifications()).resolves.toBeUndefined();
    await expect(notifications.syncAllNotifications('user-1')).resolves.toBeUndefined();
    await expect(notifications.cancelAllNotifications()).resolves.toBeUndefined();
    await expect(
      notifications.scheduleAppointmentReminder({
        id: 'a-1',
        title: 'Randevu',
        starts_at: '2030-01-01T10:00:00.000Z',
        remind_at: null,
        remind_enabled: true,
      }),
    ).resolves.toBeUndefined();
    await expect(notifications.requestNotificationPermission()).resolves.toBe(false);

    const subscription = notifications.addNotificationResponseListener(() => undefined);
    expect(typeof subscription.remove).toBe('function');
    expect(() => subscription.remove()).not.toThrow();
  });
});

/** expo-notifications'a verilen planlama isteğinin gerçek şekli. */
interface ScheduledRequest {
  identifier: string;
  content: { title: string; body: string; data: Record<string, string> };
  trigger: { type: string; date: Date };
}

describe('gerçek uygulama derlemesi', () => {
  function nativeMock() {
    return {
      setNotificationHandler: jest.fn(),
      setNotificationChannelAsync: jest.fn(async () => undefined),
      getPermissionsAsync: jest.fn(async () => ({ granted: false, canAskAgain: true })),
      requestPermissionsAsync: jest.fn(async () => ({ granted: true })),
      cancelAllScheduledNotificationsAsync: jest.fn(async () => undefined),
      cancelScheduledNotificationAsync: jest.fn(async () => undefined),
      scheduleNotificationAsync: jest.fn(async (_request: ScheduledRequest) => 'id'),
      addNotificationResponseReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
      SchedulableTriggerInputTypes: { DATE: 'date' },
      AndroidImportance: { DEFAULT: 3 },
    };
  }

  it('modülü yükler ve günlük "nasılsın?" bildirimini planlar', async () => {
    const native = nativeMock();
    jest.doMock('expo-notifications', () => native);

    const notifications = loadNotifications();
    expect(notifications.isExpoGo).toBe(false);

    await notifications.configureNotifications();
    expect(native.setNotificationHandler).toHaveBeenCalledTimes(1);

    await expect(notifications.requestNotificationPermission()).resolves.toBe(true);

    await notifications.syncAllNotifications('user-1');

    expect(native.cancelAllScheduledNotificationsAsync).toHaveBeenCalledTimes(1);
    expect(native.scheduleNotificationAsync).toHaveBeenCalledTimes(1);
    expect(native.scheduleNotificationAsync.mock.calls[0]![0]).toMatchObject({
      content: { title: 'DEVA', body: 'Nasılsın bugün?' },
    });
  });

  it('günlük bildirim kapatıldığında hiçbir şey planlamıyor', async () => {
    mockSettings.daily_checkin_enabled = false;
    const native = nativeMock();
    jest.doMock('expo-notifications', () => native);

    const notifications = loadNotifications();
    await notifications.syncAllNotifications('user-1');

    expect(native.scheduleNotificationAsync).not.toHaveBeenCalled();
  });

  it('kriz sonrası yoklama bildirimlerini 2, 5 ve 9. günlere planlar', async () => {
    mockCrisisEvents.push({ level: 'high', created_at: new Date().toISOString() });
    const native = nativeMock();
    jest.doMock('expo-notifications', () => native);

    const notifications = loadNotifications();
    await notifications.syncAllNotifications('user-1');

    // 1 günlük "nasılsın?" + 2/5/9/14/21/30 günlük kriz yoklamaları.
    expect(native.scheduleNotificationAsync).toHaveBeenCalledTimes(7);
    const crisisCalls = native.scheduleNotificationAsync.mock.calls.filter(([request]) =>
      request.identifier.startsWith('deva-crisis-'),
    );
    expect(crisisCalls).toHaveLength(6);
    expect(crisisCalls[0]![0]).toMatchObject({
      identifier: 'deva-crisis-2',
      content: { title: 'Nasıl gidiyor?' },
    });
  });

  it('kriz sonrası yoklamalar kapatıldığında yalnızca günlük bildirim kalıyor', async () => {
    mockSettings.post_crisis_followup_enabled = false;
    mockCrisisEvents.push({ level: 'critical', created_at: new Date().toISOString() });
    const native = nativeMock();
    jest.doMock('expo-notifications', () => native);

    const notifications = loadNotifications();
    await notifications.syncAllNotifications('user-1');

    expect(native.scheduleNotificationAsync).toHaveBeenCalledTimes(1);
  });

  it('yaklaşan randevuyu bir saat önce hatırlatır', async () => {
    const startsAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    mockAppointments.push({
      id: 'a-9',
      title: 'Psikolog',
      starts_at: startsAt,
      remind_at: null,
      remind_enabled: true,
    });
    const native = nativeMock();
    jest.doMock('expo-notifications', () => native);

    const notifications = loadNotifications();
    await notifications.syncAllNotifications('user-1');

    const appointmentCall = native.scheduleNotificationAsync.mock.calls.find(
      ([request]) => request.identifier === 'deva-appointment-a-9',
    );
    expect(appointmentCall).toBeDefined();
    expect(appointmentCall![0]).toMatchObject({
      content: { title: 'Randevun yaklaşıyor', body: '1 saat sonra: Psikolog' },
    });

    expect(appointmentCall![0].trigger.date.getTime()).toBe(
      new Date(startsAt).getTime() - 60 * 60 * 1000,
    );
  });

  it('bir saatten eski randevu hatırlatmasını planlamaz', async () => {
    const native = nativeMock();
    jest.doMock('expo-notifications', () => native);

    const notifications = loadNotifications();
    await notifications.scheduleAppointmentReminder({
      id: 'a-2',
      title: 'Geçmiş randevu',
      starts_at: '2020-01-01T10:00:00.000Z',
      remind_at: null,
      remind_enabled: true,
    });

    expect(native.scheduleNotificationAsync).not.toHaveBeenCalled();
  });

  it('bildirim izni reddedildiğinde akışı durdurmaz', async () => {
    jest.doMock('expo-notifications', () => ({
      getPermissionsAsync: jest.fn(async () => ({ granted: false, canAskAgain: false })),
    }));

    const notifications = loadNotifications();

    await expect(notifications.requestNotificationPermission()).resolves.toBe(false);
  });

  it('bildirim dokunulduğunda verilen adresi çağırana iletir', () => {
    let captured: ((response: unknown) => void) | null = null;
    const remove = jest.fn();
    jest.doMock('expo-notifications', () => ({
      addNotificationResponseReceivedListener: jest.fn((cb: (r: unknown) => void) => {
        captured = cb;
        return { remove };
      }),
    }));

    const notifications = loadNotifications();
    const onUrl = jest.fn();
    const subscription = notifications.addNotificationResponseListener(onUrl);

    expect(captured).not.toBeNull();
    captured!({
      notification: { request: { content: { data: { url: '/appointments' } } } },
    });
    expect(onUrl).toHaveBeenCalledWith('/appointments');

    // Adres taşımayan bildirimler yönlendirme tetiklemez.
    captured!({ notification: { request: { content: { data: {} } } } });
    expect(onUrl).toHaveBeenCalledTimes(1);

    subscription.remove();
    expect(remove).toHaveBeenCalledTimes(1);
  });
});

describe('nextDailyOccurrence', () => {
  it('saati geçtiyse yarına alır', () => {
    const notifications = loadNotifications();
    const from = new Date('2026-10-04T21:30:00');

    const next = notifications.nextDailyOccurrence('20:00', from);

    expect(next.getDate()).toBe(5);
    expect(next.getHours()).toBe(20);
    expect(next.getMinutes()).toBe(0);
  });

  it('saat henüz geçmediyse aynı günü kullanır', () => {
    const notifications = loadNotifications();
    const from = new Date('2026-10-04T09:00:00');

    const next = notifications.nextDailyOccurrence('20:00', from);

    expect(next.getDate()).toBe(4);
    expect(next.getHours()).toBe(20);
  });
});