import AsyncStorage from '@react-native-async-storage/async-storage';
import { from, loadTable } from './localDb';
import type { Row } from './localDb';

/**
 * `packages/db/sample/facilities.sample.json` ile aynı içerik. Metro dış dosya
 * import'unu sevmesin diye tek kopya olarak burada tutulur; demo kurumlar
 * yerel modda `facilities` tablosuna ilk açılışta yazılır.
 */

export interface SampleFacility extends Row {
  slug: string;
  name: string;
  type: string;
  ownership: 'public' | 'private';
  city: string;
  district: string | null;
  address: string | null;
  lat: number;
  lng: number;
  phone: string | null;
  languages: string[] | null;
  gender: 'both' | 'female' | 'male';
  is_online: boolean;
  price_range: string;
  working_hours: Record<string, string> | null;
  accepting_patients: boolean;
  promoted_weight: number;
  promoted_until: string | null;
}

export const SAMPLE_FACILITIES: SampleFacility[] = [
  {
    slug: 'demo-psikiyatri-merkezi-kadikoy-demo',
    name: 'Demo Psikiyatri Merkezi (demo)',
    type: 'psychiatry_public',
    ownership: 'public',
    city: 'İstanbul',
    district: 'Kadıköy',
    address: 'Demo Mahallesi, Demo Caddesi No:1 (demo)',
    lat: 40.9905,
    lng: 29.0272,
    phone: '+90 000 000 00 00',
    languages: ['tr'],
    gender: 'both',
    is_online: false,
    price_range: 'ucretsiz',
    working_hours: { Pzt: '09:00-17:00', Sal: '09:00-17:00', 'Çar': '09:00-17:00', Per: '09:00-17:00', Cum: '09:00-15:00' },
    accepting_patients: true,
    promoted_weight: 10,
    promoted_until: '2030-01-01T00:00:00Z',
  },
  {
    slug: 'demo-psikolog-merkezi-kadikoy-demo',
    name: 'Demo Psikolog Merkezi (demo)',
    type: 'psychologist',
    ownership: 'private',
    city: 'İstanbul',
    district: 'Kadıköy',
    address: 'Demo Mahallesi, Demo Sokak No:2 (demo)',
    lat: 40.9821,
    lng: 29.0341,
    phone: '+90 000 000 00 00',
    languages: ['tr', 'en'],
    gender: 'both',
    is_online: true,
    price_range: 'orta',
    working_hours: null,
    accepting_patients: true,
    promoted_weight: 0,
    promoted_until: null,
  },
  {
    slug: 'demo-cocuk-ergen-psikiyatri-cankaya-demo',
    name: 'Demo Çocuk Ergen Psikiyatri Polikliniği (demo)',
    type: 'child_psychiatry',
    ownership: 'public',
    city: 'Ankara',
    district: 'Çankaya',
    address: 'Demo Mahallesi, Demo Bulvarı No:3 (demo)',
    lat: 39.9337,
    lng: 32.8596,
    phone: '+90 000 000 00 00',
    languages: ['tr'],
    gender: 'both',
    is_online: false,
    price_range: 'ucuz',
    working_hours: { Pzt: '10:00-16:00', Per: '10:00-16:00' },
    accepting_patients: false,
    promoted_weight: 0,
    promoted_until: null,
  },
  {
    slug: 'demo-ozel-psikiyatri-poliklinigi-cankaya-demo',
    name: 'Demo Özel Psikiyatri Polikliniği (demo)',
    type: 'psychiatry_private',
    ownership: 'private',
    city: 'Ankara',
    district: 'Çankaya',
    address: 'Demo Mahallesi, Demo Caddesi No:4 (demo)',
    lat: 39.9208,
    lng: 32.8412,
    phone: '+90 000 000 00 00',
    languages: ['tr'],
    gender: 'both',
    is_online: true,
    price_range: 'orta',
    working_hours: null,
    accepting_patients: true,
    promoted_weight: 0,
    promoted_until: null,
  },
  {
    slug: 'demo-diyetisyen-merkezi-karsiyaka-demo',
    name: 'Demo Diyetisyen Merkezi (demo)',
    type: 'dietitian',
    ownership: 'private',
    city: 'İzmir',
    district: 'Karşıyaka',
    address: 'Demo Mahallesi, Demo Caddesi No:5 (demo)',
    lat: 38.4264,
    lng: 27.1423,
    phone: '+90 000 000 00 00',
    languages: ['tr'],
    gender: 'female',
    is_online: false,
    price_range: 'ucuz',
    working_hours: null,
    accepting_patients: true,
    promoted_weight: 0,
    promoted_until: null,
  },
  {
    slug: 'demo-universite-danismanlik-karsiyaka-demo',
    name: 'Demo Üniversite Psikolojik Danışmanlık (demo)',
    type: 'university_counseling',
    ownership: 'public',
    city: 'İzmir',
    district: 'Karşıyaka',
    address: 'Demo Kampüsü, Demo Yerleşkesi (demo)',
    lat: 38.4185,
    lng: 27.1305,
    phone: '+90 000 000 00 00',
    languages: ['tr'],
    gender: 'both',
    is_online: true,
    price_range: 'ucretsiz',
    working_hours: { Pzt: '10:00-18:00', Sal: '10:00-18:00', 'Çar': '10:00-18:00', Per: '10:00-18:00', Cum: '10:00-18:00' },
    accepting_patients: true,
    promoted_weight: 0,
    promoted_until: null,
  },
  {
    slug: 'demo-madde-bagimliligi-merkezi-nilufer-demo',
    name: 'Demo Madde Bağımlılığı Merkezi (demo)',
    type: 'substance_center',
    ownership: 'public',
    city: 'Bursa',
    district: 'Nilüfer',
    address: 'Demo Mahallesi, Demo Caddesi No:6 (demo)',
    lat: 40.1962,
    lng: 29.0688,
    phone: '+90 000 000 00 00',
    languages: ['tr'],
    gender: 'both',
    is_online: false,
    price_range: 'ucretsiz',
    working_hours: null,
    accepting_patients: true,
    promoted_weight: 0,
    promoted_until: null,
  },
  {
    slug: 'demo-psikolojik-danismanlik-nilufer-demo',
    name: 'Demo Psikolojik Danışmanlık Merkezi (demo)',
    type: 'psychological_counseling',
    ownership: 'private',
    city: 'Bursa',
    district: 'Nilüfer',
    address: 'Demo Mahallesi, Demo Sokak No:7 (demo)',
    lat: 40.1834,
    lng: 29.0521,
    phone: '+90 000 000 00 00',
    languages: ['tr'],
    gender: 'both',
    is_online: false,
    price_range: 'pahali',
    working_hours: null,
    accepting_patients: true,
    promoted_weight: 0,
    promoted_until: null,
  },
];

const SEED_FLAG = 'localdb:facilities-seeded';

export async function seedFacilitiesIfEmpty(): Promise<void> {
  const seeded = await AsyncStorage.getItem(SEED_FLAG);
  if (seeded === '1') return;
  const existing = await loadTable('facilities');
  if (existing.length === 0) {
    for (const facility of SAMPLE_FACILITIES) {
      await from('facilities').insert({
        ...facility,
        is_active: true,
        website: null,
      });
    }
  }
  await AsyncStorage.setItem(SEED_FLAG, '1');
}
