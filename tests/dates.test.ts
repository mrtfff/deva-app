import { describe, expect, it } from 'vitest';
import { daysAgoLabel, istanbulDateKey } from '../supabase/functions/_shared/dates.ts';

describe('istanbulDateKey', () => {
  it('gün sınırını Europe/Istanbul ile alır', () => {
    // 21:30 UTC = 00:30 İstanbul ertesi gün
    expect(istanbulDateKey(new Date('2026-10-04T21:30:00Z'))).toBe('2026-10-05');
    expect(istanbulDateKey(new Date('2026-10-04T20:59:00Z'))).toBe('2026-10-04');
  });
});

describe('daysAgoLabel', () => {
  const now = new Date('2026-10-04T12:00:00Z');

  it('konuşma yokken durumu yumuşak anlatır', () => {
    expect(daysAgoLabel(null, now)).toBe('Henüz sohbet yok');
    expect(daysAgoLabel('bozuk tarih', now)).toBe('Henüz sohbet yok');
  });

  it('bugünü ve dünü adlandırır', () => {
    expect(daysAgoLabel('2026-10-04T09:00:00Z', now)).toBe('Bugün');
    expect(daysAgoLabel('2026-10-03T09:00:00Z', now)).toBe('Dün');
  });

  it('ara günleri sayı olarak verir', () => {
    expect(daysAgoLabel('2026-10-01T09:00:00Z', now)).toBe('3 gün önce');
    expect(daysAgoLabel('2026-09-29T09:00:00Z', now)).toBe('5 gün önce');
  });

  it('bir haftadan eski konuşmalarda suçlamaz', () => {
    expect(daysAgoLabel('2026-09-24T09:00:00Z', now)).toBe('Haftalardır');
    expect(daysAgoLabel('2026-01-01T09:00:00Z', now)).toBe('Haftalardır');
  });

  it('gelecek tarihte Bugün der ve asla negatif gün üretmez', () => {
    expect(daysAgoLabel('2026-10-06T09:00:00Z', now)).toBe('Bugün');
  });

  it('İstanbul gün sınırını dikkate alır', () => {
    // 2026-10-03T21:30Z = 2026-10-04T00:30 İstanbul → iki tarafta da bugün
    expect(daysAgoLabel('2026-10-03T21:30:00Z', now)).toBe('Bugün');
    // 2026-10-02T21:30Z = 2026-10-03T00:30 İstanbul → İstanbul'da dün
    expect(daysAgoLabel('2026-10-02T21:30:00Z', now)).toBe('Dün');
  });
});