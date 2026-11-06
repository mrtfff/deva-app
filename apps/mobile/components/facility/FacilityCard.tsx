import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Card } from '../ui';
import type { Theme } from '../../lib/theme';

export type FacilityType =
  | 'psychiatry_public'
  | 'psychiatry_private'
  | 'psychologist'
  | 'dietitian'
  | 'child_psychiatry'
  | 'psychological_counseling'
  | 'family_therapy'
  | 'substance_center'
  | 'university_counseling';

export type FacilityOwnership = 'public' | 'private';

export type FacilityGender = 'female' | 'male' | 'both';

export type FacilityPriceRange = 'ucretsiz' | 'ucuz' | 'orta' | 'pahali';

export const FACILITY_TYPE_ORDER: FacilityType[] = [
  'psychiatry_public',
  'psychiatry_private',
  'psychologist',
  'dietitian',
  'child_psychiatry',
  'psychological_counseling',
  'family_therapy',
  'substance_center',
  'university_counseling',
];

export const FACILITY_TYPE_LABELS: Record<FacilityType, string> = {
  psychiatry_public: 'Psikiyatrist (devlet)',
  psychiatry_private: 'Psikiyatrist (özel)',
  psychologist: 'Psikolog',
  dietitian: 'Diyetisyen',
  child_psychiatry: 'Çocuk-ergen psikiyatristi',
  psychological_counseling: 'Psikolojik danışmanlık',
  family_therapy: 'Aile terapisi',
  substance_center: 'Madde bağımlılığı merkezi',
  university_counseling: 'Üniversite Psikolojik Danışmanlık',
};

export const FACILITY_OWNERSHIP_LABELS: Record<FacilityOwnership, string> = {
  public: 'Devlet',
  private: 'Özel',
};

export const FACILITY_GENDER_LABELS: Record<FacilityGender, string> = {
  female: 'Kadın',
  male: 'Erkek',
  both: 'Kadın ve erkek',
};

export const FACILITY_PRICE_LABELS: Record<FacilityPriceRange, string> = {
  ucretsiz: 'Ücretsiz',
  ucuz: 'Ucuz',
  orta: 'Orta',
  pahali: 'Pahalı',
};

export interface FacilityBase {
  id: string;
  slug: string | null;
  name: string;
  type: FacilityType;
  ownership: FacilityOwnership;
  city: string;
  district: string | null;
  address: string | null;
  phone: string | null;
  website: string | null;
  languages: string[] | null;
  gender: FacilityGender | null;
  is_online: boolean | null;
  price_range: FacilityPriceRange | null;
  working_hours: Record<string, string> | null;
  accepting_patients: boolean | null;
  lat: number;
  lng: number;
}

export interface Facility extends FacilityBase {
  distance_km: number | null;
  is_sponsored: boolean | null;
}

export function isFacilityType(value: string): value is FacilityType {
  return (FACILITY_TYPE_ORDER as string[]).includes(value);
}

/** Mesafeyi Türkçe biçimde yazar: "1,4 km". Bilinmiyorsa boş string döner. */
export function formatDistanceKm(distanceKm: number | null): string {
  if (distanceKm === null || !Number.isFinite(distanceKm)) return '';
  return `${distanceKm.toFixed(1).replace('.', ',')} km`;
}

export function facilityAddressLine(facility: FacilityBase): string {
  const street = [facility.district, facility.address].filter(Boolean).join(', ');
  return street ? `${street}, ${facility.city}` : facility.city;
}

export function directionsUrl(facility: FacilityBase): string {
  const { lat, lng, name } = facility;
  return `geo:${lat},${lng}?q=${lat},${lng}(${name})`;
}

export function openStreetMapUrl(facility: FacilityBase): string {
  const { lat, lng } = facility;
  return `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=13/${lat}/${lng}`;
}

interface ActionProps {
  theme: Theme;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
}

function ActionButton({ theme, label, icon, onPress }: ActionProps) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      hitSlop={6}
      style={({ pressed }) => [
        styles.action,
        {
          borderRadius: theme.radius,
          borderColor: theme.colors.border,
          backgroundColor: theme.colors.surfaceAlt,
          paddingHorizontal: theme.spacing.md,
          opacity: pressed ? 0.6 : 1,
        },
      ]}
    >
      <Ionicons name={icon} size={16} color={theme.colors.primary} />
      <Text style={[styles.actionLabel, { color: theme.colors.text }]}>{label}</Text>
    </Pressable>
  );
}

function Badge({ theme, label }: { theme: Theme; label: string }) {
  return (
    <View
      style={[
        styles.badge,
        {
          borderRadius: theme.radius,
          backgroundColor: theme.colors.surfaceAlt,
          paddingHorizontal: theme.spacing.sm,
        },
      ]}
    >
      <Text style={[styles.badgeLabel, { color: theme.colors.muted }]}>{label}</Text>
    </View>
  );
}

export interface FacilityCardProps {
  theme: Theme;
  facility: Facility;
  /** Kart gövdesine dokununca çalışır (kurum detayına gider). */
  onPress?: () => void;
  /** Harita anahtarı yokken liste kartlarında "Haritada aç" bağlantısı. */
  onOpenMap?: () => void;
}

export function FacilityCard({ theme, facility, onPress, onOpenMap }: FacilityCardProps) {
  const sponsored = facility.is_sponsored === true;
  const distance = formatDistanceKm(facility.distance_km);

  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      style={({ pressed }) => [pressed && onPress ? styles.pressed : null]}
    >
      <Card
        theme={theme}
        style={[
          styles.card,
          { padding: theme.spacing.lg },
          // Önerilen tek fark: sponsorlu kartın kenar rengi. Başka hiçbir görsel ayrım yok.
          sponsored ? { borderColor: theme.colors.sponsored } : null,
        ]}
      >
        <Text style={[styles.name, { color: theme.colors.text }]}>{facility.name}</Text>

        <View style={styles.badges}>
          <Badge theme={theme} label={FACILITY_TYPE_LABELS[facility.type]} />
          <Badge theme={theme} label={FACILITY_OWNERSHIP_LABELS[facility.ownership]} />
          {distance ? <Badge theme={theme} label={distance} /> : null}
        </View>

        <Text style={[styles.detail, { color: theme.colors.muted }]}>
          {facilityAddressLine(facility)}
        </Text>
        {facility.phone ? (
          <Text style={[styles.detail, { color: theme.colors.muted }]}>{facility.phone}</Text>
        ) : null}

        <View style={styles.actions}>
          {facility.phone ? (
            <ActionButton
              theme={theme}
              label="Ara"
              icon="call-outline"
              onPress={() => {
                void Linking.openURL(`tel:${facility.phone}`);
              }}
            />
          ) : null}
          <ActionButton
            theme={theme}
            label="Yol tarifi"
            icon="navigate-outline"
            onPress={() => {
              void Linking.openURL(directionsUrl(facility));
            }}
          />
          {facility.website ? (
            <ActionButton
              theme={theme}
              label="Site"
              icon="globe-outline"
              onPress={() => {
                void Linking.openURL(facility.website as string);
              }}
            />
          ) : null}
          {onOpenMap ? (
            <ActionButton
              theme={theme}
              label="Haritada aç"
              icon="map-outline"
              onPress={onOpenMap}
            />
          ) : null}
        </View>
      </Card>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: 8,
  },
  pressed: {
    opacity: 0.85,
  },
  name: {
    fontSize: 16,
    fontWeight: '600',
    lineHeight: 22,
  },
  badges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  badge: {
    paddingVertical: 4,
  },
  badgeLabel: {
    fontSize: 12,
    lineHeight: 16,
  },
  detail: {
    fontSize: 13,
    lineHeight: 19,
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4,
  },
  action: {
    minHeight: 36,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
  },
  actionLabel: {
    fontSize: 13,
    lineHeight: 18,
  },
});