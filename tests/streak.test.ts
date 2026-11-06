import { describe, expect, it } from 'vitest';
import { updateStreak } from '../supabase/functions/_shared/streak.ts';

describe('updateStreak', () => {
  it('ilk konuşmada seriyi başlatır ve kutlar', () => {
    expect(updateStreak(null, '2026-10-04')).toEqual({
      current: 1,
      longest: 1,
      lastChatDate: '2026-10-04',
      celebrate: true,
    });
  });

  it('dün konuşulduysa seriyi artırır ve kutlar', () => {
    expect(
      updateStreak({ current: 4, longest: 6, lastChatDate: '2026-10-03' }, '2026-10-04'),
    ).toEqual({ current: 5, longest: 6, lastChatDate: '2026-10-04', celebrate: true });
  });

  it('aynı gün tekrar konuşmak seriyi değiştirmez ve kutlamaz', () => {
    expect(
      updateStreak({ current: 4, longest: 6, lastChatDate: '2026-10-04' }, '2026-10-04'),
    ).toEqual({ current: 4, longest: 6, lastChatDate: '2026-10-04', celebrate: false });
  });

  it('seri koptuysa cezalandırmadan 1e döner', () => {
    expect(
      updateStreak({ current: 9, longest: 9, lastChatDate: '2026-10-01' }, '2026-10-04'),
    ).toEqual({ current: 1, longest: 9, lastChatDate: '2026-10-04', celebrate: true });
  });

  it('rekor uzunluğu yalnızca artarken güncellenir', () => {
    expect(
      updateStreak({ current: 9, longest: 9, lastChatDate: '2026-10-03' }, '2026-10-04'),
    ).toMatchObject({ current: 10, longest: 10 });
  });
});