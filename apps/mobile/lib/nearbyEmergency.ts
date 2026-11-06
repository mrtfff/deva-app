export interface EmergencyService {
  id: string;
  name: string;
  address: string | null;
  distanceKm: number;
}

const OVERPASS_URL = 'https://overpass-api.de/api/interpreter';
const THROTTLE_MS = 60_000;
const TIMEOUT_MS = 10_000;
const SEARCH_RADIUS_M = 15_000;
const MAX_RESULTS = 5;

let lastCallAt = 0;

const EARTH_RADIUS_KM = 6371;

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const toRad = (value: number) => (value * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(a));
}

interface OverpassElement {
  type: string;
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
}

/**
 * Kriz ekranındaki "En yakın acil servisi bul" düğmesi.
 * Aynı dakika içinde ikinci çağrı `null` döner; hata ve zaman aşımında da `null`.
 */
export async function getNearbyEmergency(
  lat: number,
  lng: number,
  signal?: AbortSignal,
): Promise<EmergencyService[] | null> {
  const now = Date.now();
  if (now - lastCallAt < THROTTLE_MS) return null;
  lastCallAt = now;

  const query = `[out:json][timeout:10];(node["amenity"="hospital"]["emergency"="yes"](around:${SEARCH_RADIUS_M},${lat},${lng});way["amenity"="hospital"]["emergency"="yes"](around:${SEARCH_RADIUS_M},${lat},${lng});relation["amenity"="hospital"]["emergency"="yes"](around:${SEARCH_RADIUS_M},${lat},${lng}););out center tags;`;

  try {
    const response = await fetch(OVERPASS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `data=${encodeURIComponent(query)}`,
      signal: signal ?? AbortSignal.timeout(TIMEOUT_MS),
    });

    if (!response.ok) return null;

    const payload = (await response.json()) as { elements?: OverpassElement[] };
    const elements = payload.elements ?? [];

    return elements
      .map((element) => {
        const point = element.center ?? { lat: element.lat, lon: element.lon };
        if (!point.lat || !point.lon || !element.tags?.name) return null;
        const street = element.tags['addr:street'];
        const city = element.tags['addr:city'];
        const address = [street, city].filter(Boolean).join(', ') || null;
        return {
          id: `${element.type}/${element.id}`,
          name: element.tags.name,
          address,
          distanceKm: Math.round(haversineKm(lat, lng, point.lat, point.lon) * 10) / 10,
        } satisfies EmergencyService;
      })
      .filter((item): item is EmergencyService => item !== null)
      .sort((a, b) => a.distanceKm - b.distanceKm)
      .slice(0, MAX_RESULTS);
  } catch {
    return null;
  }
}