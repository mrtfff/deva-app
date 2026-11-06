import type { Instrument, InstrumentCode } from './instruments.ts';

export interface InstrumentScore {
  score: number;
  severity: string;
}

const PHQ9_BANDS: ReadonlyArray<readonly [number, string]> = [
  [4, 'minimal'],
  [9, 'hafif'],
  [14, 'orta'],
  [19, 'orta_seviye'],
  [27, 'siddetli'],
];

const GAD7_BANDS: ReadonlyArray<readonly [number, string]> = [
  [4, 'minimal'],
  [9, 'hafif'],
  [14, 'orta'],
  [21, 'siddetli'],
];

export const SCOFF_SUSPECT_THRESHOLD = 2;

export function scoreInstrument(
  instrument: Instrument,
  answers: number[],
): InstrumentScore {
  if (!Array.isArray(answers) || answers.length !== instrument.items.length) {
    throw new Error('invalid_answers');
  }

  const max = instrument.scale === 'freq0_3' ? 3 : 1;
  for (const answer of answers) {
    if (typeof answer !== 'number' || !Number.isInteger(answer) || answer < 0 || answer > max) {
      throw new Error('invalid_answers');
    }
  }

  const score = answers.reduce((sum, a) => sum + a, 0);

  if (instrument.code === 'SCOFF') {
    return { score, severity: score >= SCOFF_SUSPECT_THRESHOLD ? 'screening_suspect' : 'below_suspect' };
  }

  const bands = instrument.code === 'PHQ9' ? PHQ9_BANDS : GAD7_BANDS;
  for (const [upper, severity] of bands) {
    if (score <= upper) return { score, severity };
  }
  return { score, severity: bands[bands.length - 1]![1] };
}

/** PHQ-9'un son maddesinde sıfırdan farklı bir işaret var mı? (sunucu kaydı için) */
function sensitiveAnswer(instrument: Instrument, answers: number[]): number | null {
  if (instrument.code !== 'PHQ9' || answers.length !== instrument.items.length) return null;
  return answers[instrument.sensitiveIndex!] ?? 0;
}

/** Herhangi bir işaret olduğunda kriz olayı kaydedilir. */
export function flagsScreeningCrisis(instrument: Instrument, answers: number[]): boolean {
  return (sensitiveAnswer(instrument, answers) ?? 0) > 0;
}

/**
 * Destek kartı yalnızca "yarıdan fazla gün" ve üzeri işaretlendiğinde çıkar.
 * Tek günlük işaretler sunucuda kayıt altına alınır ama ekranda uyarı yığmaz.
 */
export function needsSupportCard(instrument: Instrument, answers: number[]): boolean {
  return (sensitiveAnswer(instrument, answers) ?? 0) >= 2;
}

const TOPIC_BY_INSTRUMENT: Record<InstrumentCode, string> = {
  PHQ9: 'yakın dönemde ruh hali düşüklüğü belirtileri',
  GAD7: 'yakın dönemde kaygı ve huzursuzluk belirtileri',
  SCOFF: 'yeme alışkanlıkları ve kilo ile ilgili zorluklar',
};

export interface LatestScreeningResult {
  score: number;
  severity: string;
}

/**
 * Anket sonuçlarını modele verilecek konu başlıklarına çevirir.
 * Skor, bant adı ya da şiddet kelimesi bilinçli olarak hiçbir zaman üretilmez.
 */
export function buildScreeningSummaryText(
  latest: Partial<Record<InstrumentCode, LatestScreeningResult>>,
): string | undefined {
  const topics: string[] = [];
  for (const code of ['PHQ9', 'GAD7', 'SCOFF'] as const) {
    const result = latest[code];
    if (!result) continue;
    if (code === 'SCOFF' && result.score < SCOFF_SUSPECT_THRESHOLD) continue;
    topics.push(TOPIC_BY_INSTRUMENT[code]);
  }
  return topics.length > 0 ? topics.join(', ') : undefined;
}