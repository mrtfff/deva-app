import { z } from 'zod';

const TURKISH_MAP: Record<string, string> = {
  ç: 'c',
  Ç: 'c',
  ğ: 'g',
  Ğ: 'g',
  ı: 'i',
  İ: 'i',
  ö: 'o',
  Ö: 'o',
  ş: 's',
  Ş: 's',
  ü: 'u',
  Ü: 'u',
  â: 'a',
  Â: 'a',
  î: 'i',
  Î: 'i',
  û: 'u',
  Û: 'u',
};

/** Türkçe karakterleri ASCII'ye indirger, küçük harfe çevirir. */
export function slugify(input: string): string {
  let ascii = '';
  for (const ch of input) {
    ascii += TURKISH_MAP[ch] ?? ch;
  }
  const slug = ascii
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug || 'bilinmiyor';
}

/** Kurum adı + şehirden slug üretir: örn. "örnek psikiyatri-istanbul". */
export function toSlug(name: string, city: string): string {
  const namePart = slugify(name);
  const cityPart = slugify(city);
  return cityPart ? `${namePart}-${cityPart}` : namePart;
}

const facilityTypeSchema = z.enum([
  'psychiatry_public',
  'psychiatry_private',
  'psychologist',
  'dietitian',
  'child_psychiatry',
  'psychological_counseling',
  'family_therapy',
  'substance_center',
  'university_counseling',
]);

export const facilityRowSchema = z.object({
  name: z.string().trim().min(1),
  type: facilityTypeSchema,
  ownership: z.enum(['public', 'private']),
  city: z.string().trim().min(1),
  lat: z.number().finite(),
  lng: z.number().finite(),
  slug: z.string().trim().min(1).optional(),
  district: z.string().trim().min(1).optional(),
  address: z.string().trim().min(1).optional(),
  phone: z.string().trim().min(1).optional(),
  website: z.url().optional(),
  languages: z.array(z.string().trim().min(1)).default(['tr']),
  gender: z.enum(['female', 'male', 'both']).optional(),
  is_online: z.boolean().default(false),
  price_range: z.enum(['ucretsiz', 'ucuz', 'orta', 'pahali']).optional(),
  working_hours: z.record(z.string(), z.string()).nullish(),
  accepting_patients: z.boolean().default(true),
  promoted_weight: z.int().default(0),
  promoted_until: z.iso.datetime().optional(),
  is_active: z.boolean().default(true),
  notes: z.string().trim().min(1).optional(),
});

export type FacilityRow = z.infer<typeof facilityRowSchema>;

export const facilityInputSchema = z.array(facilityRowSchema);