import { describe, expect, it } from 'vitest';
import { GAD7, PHQ9, SCOFF } from '../supabase/functions/_shared/instruments.ts';
import {
  buildScreeningSummaryText,
  flagsScreeningCrisis,
  needsSupportCard,
  scoreInstrument,
} from '../supabase/functions/_shared/scoring.ts';

describe('scoreInstrument', () => {
  it('PHQ-9 toplamını hafif bandına yerleştirir', () => {
    expect(scoreInstrument(PHQ9, [1, 1, 1, 1, 1, 1, 1, 1, 1])).toEqual({ score: 9, severity: 'hafif' });
  });

  it('PHQ-9 en yüksek toplamı siddetli bandına yerleştirir', () => {
    const allThrees = new Array(9).fill(3);
    expect(scoreInstrument(PHQ9, allThrees)).toEqual({ score: 27, severity: 'siddetli' });
  });

  it('GAD-7 bantlarını doğru uygular', () => {
    expect(scoreInstrument(GAD7, [1, 1, 1, 1, 1, 1, 1])).toEqual({ score: 7, severity: 'hafif' });
    expect(scoreInstrument(GAD7, new Array(7).fill(3))).toEqual({ score: 21, severity: 'siddetli' });
  });

  it('SCOFF eşiği iki işaretle aşar', () => {
    expect(scoreInstrument(SCOFF, [1, 1, 0, 0, 0])).toEqual({
      score: 2,
      severity: 'screening_suspect',
    });
    expect(scoreInstrument(SCOFF, [1, 0, 0, 0, 0])).toEqual({ score: 1, severity: 'below_suspect' });
  });

  it('ölçek dışı ya da eksik yanıtları reddeder', () => {
    expect(() => scoreInstrument(PHQ9, [5])).toThrow('invalid_answers');
    expect(() => scoreInstrument(PHQ9, [1, 1, 1])).toThrow('invalid_answers');
    expect(() => scoreInstrument(PHQ9, [1, 1, 1, 1, 1, 1, 1, 1, 1, 1])).toThrow('invalid_answers');
    expect(() => scoreInstrument(SCOFF, [1, 3, 0, 0, 0])).toThrow('invalid_answers');
  });
});

describe('PHQ-9 son maddesi', () => {
  it('destek kartı yalnızca yarıdan fazla gün ve üzeri işarette çıkar', () => {
    expect(needsSupportCard(PHQ9, [1, 1, 1, 1, 1, 1, 1, 1, 0])).toBe(false);
    expect(needsSupportCard(PHQ9, [1, 1, 1, 1, 1, 1, 1, 1, 1])).toBe(false);
    expect(needsSupportCard(PHQ9, [1, 1, 1, 1, 1, 1, 1, 1, 2])).toBe(true);
    expect(needsSupportCard(PHQ9, [1, 1, 1, 1, 1, 1, 1, 1, 3])).toBe(true);
  });

  it('kriz olayı tek günlük işarette bile kaydedilir', () => {
    expect(flagsScreeningCrisis(PHQ9, [1, 1, 1, 1, 1, 1, 1, 1, 0])).toBe(false);
    expect(flagsScreeningCrisis(PHQ9, [1, 1, 1, 1, 1, 1, 1, 1, 1])).toBe(true);
    expect(flagsScreeningCrisis(PHQ9, [1, 1, 1, 1, 1, 1, 1, 1, 3])).toBe(true);
  });

  it('diğer ölçeklerde ikisi de devre dışıdır', () => {
    expect(needsSupportCard(GAD7, [3, 3, 3, 3, 3, 3, 3])).toBe(false);
    expect(needsSupportCard(SCOFF, [1, 1, 1, 1, 1])).toBe(false);
    expect(flagsScreeningCrisis(GAD7, [3, 3, 3, 3, 3, 3, 3])).toBe(false);
    expect(flagsScreeningCrisis(SCOFF, [1, 1, 1, 1, 1])).toBe(false);
  });
});

describe('buildScreeningSummaryText', () => {
  it('konu başlıkları üretir, skor ya da şiddet kelimesi üretmez', () => {
    const summary = buildScreeningSummaryText({
      PHQ9: { score: 22, severity: 'siddetli' },
      GAD7: { score: 11, severity: 'orta' },
    });
    expect(summary).toContain('ruh hali düşüklüğü');
    expect(summary).toContain('kaygı');
    expect(summary).not.toMatch(/\d/);
    expect(summary).not.toMatch(/siddetli|orta|hafif|skor|şiddet/i);
  });

  it('eşik altındaki SCOFF sonucunu hiç anmaz', () => {
    expect(buildScreeningSummaryText({ SCOFF: { score: 1, severity: 'below_suspect' } })).toBeUndefined();
    expect(
      buildScreeningSummaryText({ SCOFF: { score: 3, severity: 'screening_suspect' } }),
    ).toContain('yeme alışkanlıkları');
  });

  it('sonuç yoksa özet üretmez', () => {
    expect(buildScreeningSummaryText({})).toBeUndefined();
  });
});