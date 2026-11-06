import { describe, expect, it } from 'vitest';
import { FREE_LIMIT, PRO_LIMIT, resolveQuota } from '../supabase/functions/_shared/quota.ts';

describe('resolveQuota', () => {
  it('ücretsiz sınır aşılınca kısalır ama kapanmaz', () => {
    expect(resolveQuota({ usedToday: 31, isPro: false })).toEqual({
      degraded: true,
      limit: FREE_LIMIT,
      maxOutputTokens: 200,
      historyWindow: 6,
      memoryExtraction: false,
    });
  });

  it('sınır dolmadan önce tam bağlamla yanıt verir', () => {
    expect(resolveQuota({ usedToday: 5, isPro: false })).toEqual({
      degraded: false,
      limit: FREE_LIMIT,
      maxOutputTokens: 420,
      historyWindow: 12,
      memoryExtraction: true,
    });
  });

  it('sınırın tam olarak dolduğu mesajda kısalır', () => {
    expect(resolveQuota({ usedToday: FREE_LIMIT, isPro: false }).degraded).toBe(true);
  });

  it('pro kullanıcı 200 mesaja kadar kısılmaz', () => {
    expect(resolveQuota({ usedToday: PRO_LIMIT - 1, isPro: true })).toMatchObject({
      degraded: false,
      limit: PRO_LIMIT,
    });
    expect(resolveQuota({ usedToday: PRO_LIMIT + 1, isPro: true })).toMatchObject({
      degraded: true,
      limit: PRO_LIMIT,
    });
  });
});