export const FREE_LIMIT = 30;
export const PRO_LIMIT = 200;

export interface QuotaInput {
  usedToday: number;
  isPro: boolean;
}

export interface QuotaPolicy {
  degraded: boolean;
  limit: number;
  maxOutputTokens: number;
  historyWindow: number;
  memoryExtraction: boolean;
}

/** Ücretsiz kullanıcı günlük sınırı doldurduğunda DEVA kısalır, kapanmaz. */
export function resolveQuota({ usedToday, isPro }: QuotaInput): QuotaPolicy {
  const limit = isPro ? PRO_LIMIT : FREE_LIMIT;
  const degraded = usedToday >= limit;
  return {
    degraded,
    limit,
    maxOutputTokens: degraded ? 200 : 420,
    historyWindow: degraded ? 6 : 12,
    memoryExtraction: !degraded,
  };
}