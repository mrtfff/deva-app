import { describe, expect, it } from 'vitest';
import { buildTriage, extractMessageSignals } from '../supabase/functions/_shared/triage.ts';
import type { TriageInput } from '../supabase/functions/_shared/triage.ts';

const base: TriageInput = {
  crisisLevel: 'none',
  hasRecentHighCrisis: false,
  screening: {},
  messageSignals: { psychosis: false, medication: false, eating: false },
};

const FORBIDDEN_IN_REASON = /\d|\b(skor|puan|şiddet|hafif|orta seviye|siddetli|minimal)\b/i;

describe('buildTriage öncelik sırası', () => {
  it('son 30 günde yüksek kriz varsa psikiyatrist önerir', () => {
    expect(buildTriage({ ...base, hasRecentHighCrisis: true }).type).toBe('psychiatrist');
  });

  it('anlık kriz seviyesi de psikiyatriste gider', () => {
    expect(buildTriage({ ...base, crisisLevel: 'critical' }).type).toBe('psychiatrist');
  });

  it('psikoz sinyali psikiyatriste gider', () => {
    expect(
      buildTriage({ ...base, messageSignals: { ...base.messageSignals, psychosis: true } }).type,
    ).toBe('psychiatrist');
  });

  it('ilacı olan kullanıcı psikiyatriste gider', () => {
    expect(
      buildTriage({ ...base, messageSignals: { ...base.messageSignals, medication: true } }).type,
    ).toBe('psychiatrist');
  });

  it('kriz önceliği yeme sinyalinden önce gelir', () => {
    const result = buildTriage({
      ...base,
      hasRecentHighCrisis: true,
      messageSignals: { ...base.messageSignals, eating: true },
    });
    expect(result.type).toBe('psychiatrist');
  });

  it('SCOFF şüphesi diyetisyene gider', () => {
    expect(buildTriage({ ...base, screening: { scoff: { flagged: true } } }).type).toBe('dietitian');
  });

  it('yeme sinyali diyetisyene gider', () => {
    expect(
      buildTriage({ ...base, messageSignals: { ...base.messageSignals, eating: true } }).type,
    ).toBe('dietitian');
  });

  it('SCOFF eşiğin altındaysa diyetisyene gitmez', () => {
    expect(buildTriage({ ...base, screening: { scoff: { flagged: false } } }).type).toBe(
      'psychologist',
    );
  });

  it('sinyal yoksa psikolog önerir', () => {
    expect(buildTriage(base).type).toBe('psychologist');
  });

  it('gerekçede skor ya da şiddet dili yoktur', () => {
    const reasons = [
      buildTriage({ ...base, hasRecentHighCrisis: true }),
      buildTriage({ ...base, messageSignals: { ...base.messageSignals, psychosis: true } }),
      buildTriage({ ...base, messageSignals: { ...base.messageSignals, medication: true } }),
      buildTriage({ ...base, screening: { scoff: { flagged: true } } }),
      buildTriage(base),
    ].map((r) => r.reason);

    for (const reason of reasons) {
      expect(reason.length).toBeGreaterThan(10);
      expect(reason).not.toMatch(FORBIDDEN_IN_REASON);
    }
  });
});

describe('extractMessageSignals', () => {
  it('metinleri tarayıp sinyalleri toplar', () => {
    expect(extractMessageSignals(['kilo vermek için aç kaldım'])).toEqual({
      psychosis: false,
      medication: false,
      eating: true,
    });
    expect(extractMessageSignals(['doktorum antidepresan yazdı'])).toEqual({
      psychosis: false,
      medication: true,
      eating: false,
    });
    expect(extractMessageSignals(['odamda biri fısılda, bizi izliyor'])).toEqual({
      psychosis: true,
      medication: false,
      eating: false,
    });
  });

  it('birden çok mesajda geçen sinyalleri birleştirir', () => {
    expect(extractMessageSignals(['ilacımı bıraktım', 'hayaletler görüyorum'])).toEqual({
      psychosis: true,
      medication: true,
      eating: false,
    });
  });

  it('alakasız metinlerde sinyal bulmaz', () => {
    expect(extractMessageSignals(['', 'bugün hava güzel', '   '])).toEqual({
      psychosis: false,
      medication: false,
      eating: false,
    });
  });
});