import { loadTable } from './localDb';
import type { Row } from './localDb';

/**
 * `nearby_facilities` RPC'sinin birebir TS karşılığı (supabase/migrations/0001_init.sql):
 * haversine mesafe, tip/mülkiyet filtresi, sponsor sıralaması, yuvarlanmış mesafe.
 */

export interface NearbyParams {
  lat: number;
  lng: number;
  types: string[] | null;
  ownership: string | null;
  limit: number;
}

export interface NearbyFacilityRow extends Row {
  id: string;
  slug: string | null;
  name: string;
  type: string;
  ownership: string;
  city: string;
  district: string | null;
  address: string | null;
  phone: string | null;
  website: string | null;
  languages: string[] | null;
  gender: string;
  is_online: boolean;
  price_range: string;
  working_hours: Record<string, string> | null;
  accepting_patients: boolean;
  distance_km: number | null;
  is_sponsored: boolean;
}

/** İki nokta arası büyük daire mesafesi (km). */
export function haversineKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(a));
}

export async function nearbyFacilities(params: NearbyParams): Promise<NearbyFacilityRow[]> {
  const facilities = await loadTable('facilities');
  const now = new Date().toISOString();

  type ScoredRow = Row & { distance_km: number; is_sponsored: boolean };
  const scored: ScoredRow[] = facilities
    .filter((facility) => facility.is_active === true)
    .filter(
      (facility) =>
        params.types === null ||
        (params.types.length > 0 && params.types.includes(facility.type as string)),
    )
    .filter(
      (facility) => params.ownership === null || facility.ownership === params.ownership,
    )
    .map((facility) => {
      const distance = haversineKm(
        params.lat,
        params.lng,
        facility.lat as number,
        facility.lng as number,
      );
      const promotedUntil = facility.promoted_until as string | null | undefined;
      return {
        ...facility,
        distance_km: Math.round(distance * 10) / 10,
        is_sponsored: Boolean(promotedUntil) && promotedUntil! > now,
      };
    });

  scored.sort((a, b) => {
    if (a.is_sponsored !== b.is_sponsored) return a.is_sponsored ? -1 : 1;
    const weightA = (a.promoted_weight as unknown as number | null | undefined) ?? 0;
    const weightB = (b.promoted_weight as unknown as number | null | undefined) ?? 0;
    if (weightA !== weightB) return weightB - weightA;
    return a.distance_km - b.distance_km;
  });

  return scored.slice(0, params.limit) as unknown as NearbyFacilityRow[];
}
