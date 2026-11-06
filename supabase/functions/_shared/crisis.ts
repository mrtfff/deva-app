import type { CrisisLevel } from './types.ts';

const CRITICAL_PATTERNS: readonly string[] = [
  'kendimi öldürmek',
  'hayatıma son vermek',
  'kendime zarar vereceğim',
  'kendimi kesiyorum',
  'kendimi kesme',
  'ilaç içeceğim',
  'hap içeceğim',
  'ölmek istiyorum',
  'intihar edeceğim',
  'kendimi öldürmek istiyorum',
];

const HIGH_PATTERNS: readonly string[] = [
  'yapmak istemiyorum',
  'dayanamıyorum',
  'kaçmak istiyorum',
  'kimse beni istemiyor',
  'kimse beni anlamıyor',
  'boşluğa düştüm',
  'hiçbir şey hissetmiyorum',
  'kendime zarar verme',
  'acı çekiyorum',
  'son çare',
  'dayanacak gücüm kalmadı',
];

const LOW_PATTERNS: readonly string[] = [
  'çok yorgunum',
  'moralim bozuk',
  'umutsuzum',
  'kötüyüm',
  'kendimi değersiz hissediyorum',
  'yalnızım',
  'ağlamak istiyorum',
];

const WEIGHTS = {
  critical: 3,
  high: 2,
  low: 1,
} as const;

export const CRISIS_WARN_TEXT =
  "Bunu söylemek istediğine göre çok ağır bir şeyler yaşıyorsun. Burada sana bir şey dayatmak ya da hemen çözüm vermek istemem — sadece dinliyorum. İstersen biraz daha anlat, istersen sadece biraz dur.";

/** Sohbet içi kalıcı kriz kartında kullanıcıya gösterilen yumuşak destek satırı. */
export const CRISIS_SOFT_SUPPORT_TEXT = "112'yi arayabilirsin, her an.";

const CHAR_MAP: Record<string, string> = {
  İ: 'i',
  I: 'i',
  ı: 'i',
  Ş: 's',
  ş: 's',
  Ğ: 'g',
  ğ: 'g',
  Ü: 'u',
  ü: 'u',
  Ö: 'o',
  ö: 'o',
  Ç: 'c',
  ç: 'c',
  Â: 'a',
  â: 'a',
  Î: 'i',
  î: 'i',
  Û: 'u',
  û: 'u',
  Ê: 'e',
  ê: 'e',
  '’': "'",
  '‘': "'",
  '“': '"',
  '”': '"',
  '–': '-',
  '—': '-',
};

/**
 * Türkçe kurallarına uygun küçük harfe çevirme: 'I' → 'ı' değil 'i',
 * 'İ' → 'i'. JavaScript'in varsayılan toLowerCase'i 'I' harfini 'i' yapar ve
 * 'İ' harfini noktasız 'i' üretmez; bu yüzden eşleme tabanında hata oluşur.
 */
export function toLowerCaseTr(input: string): string {
  return input.replace(/İ/g, 'i').replace(/I/g, 'ı').toLowerCase();
}

/** Küçük harf + aksan sökme + boşluk sıkıştırma: eşleme bu metin üzerinde yapılır. */
export function normalizeText(input: string): string {
  let out = '';
  for (const ch of toLowerCaseTr(input)) out += CHAR_MAP[ch] ?? ch;
  return out.toLowerCase().replace(/\s+/g, ' ').trim();
}

/** Deseni kelime sınırlarıyla arar; kelime ortası eşleşmeleri sayılmaz. */
function includesPattern(haystack: string, needle: string): boolean {
  let from = 0;
  for (;;) {
    const at = haystack.indexOf(needle, from);
    if (at === -1) return false;
    const before = at === 0 ? ' ' : haystack[at - 1]!;
    const after = at + needle.length >= haystack.length ? ' ' : haystack[at + needle.length]!;
    const isBoundary = !/[a-z0-9']/.test(before) && !/[a-z0-9']/.test(after);
    if (isBoundary) return true;
    from = at + 1;
  }
}

/**
 * Birbirinin içinde geçen desenleri iki kez saymaz.
 * "kendimi öldürmek" zaten "kendimi öldürmek istiyorum" ifadesinin içinde
 * olduğu için ikisini de saymak şiddeti gereksiz şişirir.
 */
function dedupeOverlapping(patterns: string[]): string[] {
  const byLengthDesc = [...patterns].sort((a, b) => b.length - a.length);
  const kept: string[] = [];
  for (const candidate of byLengthDesc) {
    if (!kept.some((k) => k.includes(candidate))) kept.push(candidate);
  }
  return kept;
}

const THIRD_PERSON_RE = /\b(bir|arkadasim|komsum|babam|annem|o|siz)\b/;
const QUESTIONING_RE = /[?"']|\bne yapmali\b|\bnasil yardim\b/;
const FIRST_PERSON_RE = /\b(ben|bana|bende|benden|kendimi|kendime)\b/;

export interface CrisisDetection {
  level: CrisisLevel;
  score: number;
  matched: string[];
}

function downgrade(level: CrisisLevel): CrisisLevel {
  if (level === 'critical') return 'high';
  if (level === 'high') return 'low';
  return 'none';
}

export function detectCrisis(text: string): CrisisDetection {
  const normalized = normalizeText(text ?? '');
  if (!normalized) return { level: 'none', score: 0, matched: [] };

  const matchIn = (patterns: readonly string[]) =>
    patterns.filter((p) => includesPattern(normalized, normalizeText(p)));

  const critical = dedupeOverlapping(matchIn(CRITICAL_PATTERNS));
  const high = dedupeOverlapping(matchIn(HIGH_PATTERNS));
  const low = dedupeOverlapping(matchIn(LOW_PATTERNS));

  const score =
    critical.length * WEIGHTS.critical + high.length * WEIGHTS.high + low.length * WEIGHTS.low;

  const matched = [...critical, ...high, ...low];

  let level: CrisisLevel = 'none';
  if (critical.length >= 2) level = 'critical';
  else if (critical.length >= 1) level = 'high';
  else if (score >= 4) level = 'high';
  else if (matched.length >= 1) level = 'low';

  // Üçüncü kişi hakkında bir soru soruluyorsa ve kullanıcı kendinden bahsetmiyorsa
  // bir kademe düşür: "arkadaşım intihar etti" DEVA'nın kendi krizi değildir.
  if (
    level !== 'none' &&
    THIRD_PERSON_RE.test(normalized) &&
    QUESTIONING_RE.test(normalized) &&
    !FIRST_PERSON_RE.test(normalized)
  ) {
    level = downgrade(level);
  }

  return { level, score, matched };
}