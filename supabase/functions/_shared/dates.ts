export const APP_TIME_ZONE = 'Europe/Istanbul';

/** Türkiye 2016'dan beri kalıcı UTC+3; Intl yoksa yedek yol budur. */
const FALLBACK_OFFSET_MINUTES = 180;

function istanbulParts(date: Date): { year: number; month: number; day: number } {
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: APP_TIME_ZONE,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(date);
    const pick = (type: string) => Number.parseInt(parts.find((p) => p.type === type)!.value, 10);
    return { year: pick('year'), month: pick('month'), day: pick('day') };
  } catch {
    const shifted = new Date(date.getTime() + FALLBACK_OFFSET_MINUTES * 60_000);
    return {
      year: shifted.getUTCFullYear(),
      month: shifted.getUTCMonth() + 1,
      day: shifted.getUTCDate(),
    };
  }
}

/** `YYYY-AA-GG` biçiminde İstanbul günü. Sunucu gün sınırıyla aynı hesap. */
export function istanbulDateKey(date: Date = new Date()): string {
  const { year, month, day } = istanbulParts(date);
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function dayNumberFromKey(key: string): number {
  const [y, m, d] = key.split('-').map((part) => Number.parseInt(part, 10));
  return Date.UTC(y ?? 1970, (m ?? 1) - 1, d ?? 1) / 86_400_000;
}

/** Son konuşmanın ne kadar önce olduğunu yumuşak biçimde anlatır. */
export function daysAgoLabel(lastIso: string | null, now: Date = new Date()): string {
  if (!lastIso) return 'Henüz sohbet yok';

  const last = new Date(lastIso);
  if (Number.isNaN(last.getTime())) return 'Henüz sohbet yok';

  const days = dayNumberFromKey(istanbulDateKey(now)) - dayNumberFromKey(istanbulDateKey(last));
  if (days <= 0) return 'Bugün';
  if (days === 1) return 'Dün';
  if (days >= 7) return 'Haftalardır';
  return `${days} gün önce`;
}