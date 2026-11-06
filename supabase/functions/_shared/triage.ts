import { normalizeText } from './crisis.ts';
import type { CrisisLevel, ScreeningSummary, SpecialistType } from './types.ts';

export interface MessageSignals {
  psychosis: boolean;
  medication: boolean;
  eating: boolean;
}

export interface TriageInput {
  crisisLevel: CrisisLevel;
  hasRecentHighCrisis: boolean;
  screening: ScreeningSummary;
  messageSignals: MessageSignals;
}

export interface TriageResult {
  type: SpecialistType;
  reason: string;
}

const PSYCHOSIS_RE =
  /\b(sanr|halusinasyon|hayalet|duydugumu|duyuyorum|gordugum ama yok|bizi izliyor|fisilda|parano)/;
const MEDICATION_RE = /\b(ilac|ilaclari|hap|haplar|antidepresan|tedavi goruyorum|doktor)/;
const EATING_RE =
  /\b(yeme bozuklugu|kilo|kilo verdim|zayifladim|ac kaldim|tikiniyorum|kusuyorum|purge)/;

/** Son kullanıcı mesajlarından yönlendirme sinyallerini çıkarır. */
export function extractMessageSignals(texts: string[]): MessageSignals {
  const signals: MessageSignals = { psychosis: false, medication: false, eating: false };
  for (const text of texts) {
    const n = normalizeText(text ?? '');
    if (!n) continue;
    if (PSYCHOSIS_RE.test(n)) signals.psychosis = true;
    if (MEDICATION_RE.test(n)) signals.medication = true;
    if (EATING_RE.test(n)) signals.eating = true;
  }
  return signals;
}

/**
 * Sohbet + anket birlikte değerlendirilip tek birincil uzman seçilir.
 * Gerekçe cümleleri hiçbir zaman skor, bant ya da şiddet kelimesi içermez.
 */
export function buildTriage(input: TriageInput): TriageResult {
  const crisisIsHigh = input.crisisLevel === 'high' || input.crisisLevel === 'critical';

  if (input.hasRecentHighCrisis || crisisIsHigh) {
    return {
      type: 'psychiatrist',
      reason:
        'Son bir süredir kendine zarar düşüncesinden bahsediyorsun; bu konuda bir psikiyatrist (tıp doktoru) ile konuşmak daha doğru olur.',
    };
  }

  if (input.messageSignals.psychosis) {
    return {
      type: 'psychiatrist',
      reason:
        'Bazı düşüncelerini çok gerçekmiş gibi anlattın; bunları bir psikiyatrist değerlendirebilir.',
    };
  }

  if (input.messageSignals.medication) {
    return {
      type: 'psychiatrist',
      reason:
        'Şu an bir tedavi görüyor gibi anlatıyorsun; ilacını ve durumunu bir psikiyatrist takip edebilir.',
    };
  }

  if (input.screening.scoff?.flagged || input.messageSignals.eating) {
    return {
      type: 'dietitian',
      reason:
        'Yeme ve kilo ile ilgili zor bir dönemden geçiyor gibi görünüyorsun; bir diyetisyen sana daha iyi yardımcı olabilir.',
    };
  }

  return {
    type: 'psychologist',
    reason:
      'Konuştuğumuz şeyler psikolojik destek için uygun görünüyor; bir psikolog seninle çalışabilir.',
  };
}

export const SPECIALIST_LABELS: Record<SpecialistType, string> = {
  psychiatrist: 'Psikiyatrist (tıp doktoru) öneriyoruz',
  psychologist: 'Psikolog öneriyoruz',
  dietitian: 'Diyetisyen öneriyoruz',
};

/** Yönlendirme ekranındaki "başka uzman da olabilir" seçenekleri. */
export const ALTERNATIVE_FACILITY_TYPES: Record<SpecialistType, SpecialistType[]> = {
  psychiatrist: ['psychologist'],
  psychologist: ['psychiatrist', 'dietitian'],
  dietitian: ['psychologist'],
};

export const FACILITY_TYPES_BY_SPECIALIST: Record<SpecialistType, string[]> = {
  psychiatrist: ['psychiatry_public', 'psychiatry_private', 'child_psychiatry'],
  psychologist: [
    'psychologist',
    'psychological_counseling',
    'family_therapy',
    'university_counseling',
    'substance_center',
  ],
  dietitian: ['dietitian'],
};