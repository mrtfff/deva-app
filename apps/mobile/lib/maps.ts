import { requireOptionalNativeModule } from 'expo-modules-core';
import type { ComponentType } from 'react';
import type * as ExpoMaps from 'expo-maps';

export const GOOGLE_MAPS_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY ?? '';

/**
 * `expo-maps` import edildiği anda `requireNativeModule('ExpoMaps')` çağırıyor ve
 * Expo Go'da (SDK 53+ uzak modüller dışında kalan native modüller de dahil)
 * o modül bulunmadığı için uygulama çöküyor.
 *
 * `requireOptionalNativeModule` hata fırlatmadan null döner; böylece modüle hiç
 * dokunmadan durumu öğrenip yalnızca gerçekten kullanılacaksa yüklüyoruz.
 */
export const isNativeMapsAvailable = requireOptionalNativeModule('ExpoMaps') !== null;

/** Harita ancak native modül **ve** Google Maps anahtarı varsa çizilir. */
export const isMapsAvailable = isNativeMapsAvailable && GOOGLE_MAPS_KEY.trim().length > 0;

/** Harita yoksa nedenini kullanıcıya anlatacak tek satır. */
export function mapsUnavailableReason(): string {
  if (!isNativeMapsAvailable) {
    return 'Bu derlemede harita modülü yok. Aşağıdaki kartlardaki "Haritada aç" bağlantısını kullanabilirsin.';
  }
  if (!GOOGLE_MAPS_KEY.trim()) {
    return 'Harita anahtarı tanımlı değil. Aşağıdaki kartlardaki "Haritada aç" bağlantısını kullanabilirsin.';
  }
  return 'Harita şu an açılamıyor. Aşağıdaki kartlardaki "Haritada aç" bağlantısını kullanabilirsin.';
}

export function loadGoogleMapsView(): ComponentType<ExpoMaps.GoogleMaps.MapProps> | null {
  if (!isMapsAvailable) return null;
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- koşullu yükleme: native modül yoksa modül hiç çalıştırılmamalı
  const expoMaps = require('expo-maps') as typeof import('expo-maps');
  return expoMaps.GoogleMaps.View;
}