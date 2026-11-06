import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import type { Href } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FACILITY_TYPES_BY_SPECIALIST } from '@shared/triage';
import type { City } from '@shared/cities';
import type { SpecialistType } from '@shared/types';
import { useTheme } from '../../components/ThemeProvider';
import {
  Chip,
  EmptyState,
  PrimaryButton,
  SectionTitle,
} from '../../components/ui';
import {
  FACILITY_OWNERSHIP_LABELS,
  FACILITY_TYPE_LABELS,
  FACILITY_TYPE_ORDER,
  FacilityCard,
  isFacilityType,
  type Facility,
  type FacilityOwnership,
  type FacilityType,
} from '../../components/facility/FacilityCard';
import { supabase } from '../../lib/supabase';
import { CityPickerModal, useCityPicker } from '../../lib/useCityPicker';

const LIMIT = 50;

const EMPTY_MESSAGE = 'Bu bölgede kayıtlı bir kurum yok. Farklı bir il seçebilirsin.';

const OWNERSHIP_FILTERS: { key: 'all' | FacilityOwnership; label: string }[] = [
  { key: 'all', label: 'Tümü' },
  { key: 'public', label: FACILITY_OWNERSHIP_LABELS.public },
  { key: 'private', label: FACILITY_OWNERSHIP_LABELS.private },
];

interface NearbyRow {
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
  gender: Facility['gender'];
  is_online: boolean | null;
  price_range: Facility['price_range'];
  working_hours: Record<string, string> | null;
  accepting_patients: boolean | null;
  distance_km: number | null;
  is_sponsored: boolean | null;
}

export interface FacilityQuery {
  lat: number;
  lng: number;
  types: FacilityType[];
  ownership: 'all' | FacilityOwnership;
}

/**
 * `nearby_facilities` RPC'sini çağırır ve mesafe sırasına göre döndürür.
 * RPC koordinat döndürmediği için kısa bir ikinci sorguyla `lat`/`lng` tamamlanır.
 */
export async function loadNearbyFacilities(query: FacilityQuery): Promise<Facility[]> {
  const { data, error } = await supabase.rpc('nearby_facilities', {
    p_lat: query.lat,
    p_lng: query.lng,
    p_types: query.types.length > 0 ? query.types : null,
    p_ownership: query.ownership === 'all' ? null : query.ownership,
    p_limit: LIMIT,
  });

  if (error) throw new Error('nearby_facilities');

  const rows = (data as NearbyRow[] | null) ?? [];
  if (rows.length === 0) return [];

  const { data: coords } = await supabase
    .from('facilities')
    .select('id, lat, lng')
    .in(
      'id',
      rows.map((row) => row.id),
    );

  const positions = new Map<string, { lat: number; lng: number }>();
  for (const row of (coords as { id: string; lat: number; lng: number }[] | null) ?? []) {
    positions.set(row.id, { lat: row.lat, lng: row.lng });
  }

  return rows
    .map((row) => {
      const position = positions.get(row.id);
      if (!position) return null;
      return { ...row, lat: position.lat, lng: position.lng } satisfies Facility;
    })
    .filter((row): row is Facility => row !== null)
    .sort(
      (a, b) =>
        (a.distance_km ?? Number.POSITIVE_INFINITY) -
        (b.distance_km ?? Number.POSITIVE_INFINITY),
    );
}

interface Origin {
  lat: number;
  lng: number;
  label: string;
}

export default function FacilitiesScreen() {
  const { theme } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const picker = useCityPicker();
  const params = useLocalSearchParams();
  const requestedType = Array.isArray(params.type) ? params.type[0] : params.type;

  const [origin, setOrigin] = useState<Origin | null>(null);
  const [locating, setLocating] = useState(false);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [types, setTypes] = useState<FacilityType[]>([]);
  const [ownership, setOwnership] = useState<'all' | FacilityOwnership>('all');
  const [facilities, setFacilities] = useState<Facility[]>([]);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);

  // Yönlendirme ekranından "?type=" ile gelindiğinde ilgili filtreler seçili gelir.
  useEffect(() => {
    if (!requestedType) return;
    if (isFacilityType(requestedType)) {
      setTypes([requestedType]);
      return;
    }
    const specialistTypes = (FACILITY_TYPES_BY_SPECIALIST as Record<string, string[]>)[
      requestedType as SpecialistType
    ];
    if (specialistTypes) {
      setTypes(specialistTypes.filter(isFacilityType));
    }
  }, [requestedType]);

  const load = useCallback(async () => {
    if (!origin) return;
    setLoading(true);
    try {
      const rows = await loadNearbyFacilities({ lat: origin.lat, lng: origin.lng, types, ownership });
      setFacilities(rows);
    } catch {
      setFacilities([]);
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }, [origin, types, ownership]);

  useEffect(() => {
    void load();
  }, [load]);

  // Konum yalnızca kullanıcı "Yakınımdakileri göster" dedikten sonra istenir.
  const requestNearby = useCallback(async () => {
    setLocating(true);
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== 'granted') {
        setPermissionDenied(true);
        picker.open();
        return;
      }
      const position = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      setPermissionDenied(false);
      setOrigin({
        lat: position.coords.latitude,
        lng: position.coords.longitude,
        label: 'Konumun',
      });
    } catch {
      setPermissionDenied(true);
      picker.open();
    } finally {
      setLocating(false);
    }
  }, [picker.open]);

  const handleCitySelect = useCallback(
    (city: City) => {
      picker.select(city);
      setOrigin({ lat: city.lat, lng: city.lng, label: city.name });
    },
    [picker.select],
  );

  const toggleType = useCallback((type: FacilityType) => {
    setTypes((current) =>
      current.includes(type) ? current.filter((item) => item !== type) : [...current, type],
    );
  }, []);

  const mapHref = useMemo<Href | null>(
    () => (origin ? `/facilities/map?lat=${origin.lat}&lng=${origin.lng}` : null),
    [origin],
  );

  if (!origin) {
    return (
      <View style={[styles.flex, { backgroundColor: theme.colors.bg }]}>
        <ScrollView
          contentContainerStyle={[
            styles.page,
            { padding: theme.spacing.xl, paddingBottom: insets.bottom + theme.spacing.xl },
          ]}
        >
          <Text style={[styles.heading, { color: theme.colors.text }]}>Uzmanlar</Text>
          <Text style={[styles.body, { color: theme.colors.text }]}>
            Sana en uygun tek uzmanı önerdik. Şimdi yakınındaki kurumları görebilirsin.
          </Text>
          <Text style={[styles.note, { color: theme.colors.muted }]}>
            {permissionDenied
              ? 'Konum izni verilmediği için bir il seçebilirsin.'
              : 'Konumun yalnızca kurumları sıralamak için kullanılır.'}
          </Text>
          <View style={{ marginTop: theme.spacing.xl, gap: theme.spacing.md }}>
            <PrimaryButton
              theme={theme}
              label="Yakınımdakileri göster"
              busy={locating}
              onPress={() => {
                void requestNearby();
              }}
            />
            <PrimaryButton
              theme={theme}
              variant="secondary"
              label="Bir il seç"
              onPress={picker.open}
            />
          </View>
        </ScrollView>
        <CityPickerModal
          visible={picker.visible}
          cities={picker.cities}
          selected={picker.selected}
          onSelect={handleCitySelect}
          onClose={picker.close}
        />
      </View>
    );
  }

  return (
    <View style={[styles.flex, { backgroundColor: theme.colors.bg }]}>
      <FlatList
        data={facilities}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[
          styles.list,
          { padding: theme.spacing.lg, paddingBottom: insets.bottom + theme.spacing.xl },
        ]}
        renderItem={({ item }) => (
          <FacilityCard
            theme={theme}
            facility={item}
            onPress={() => router.push(`/facilities/${item.id}`)}
          />
        )}
        ListHeaderComponent={
          <View style={{ gap: theme.spacing.md, marginBottom: theme.spacing.md }}>
            <View style={styles.headerRow}>
              <View style={styles.flex}>
                <Text style={[styles.overline, { color: theme.colors.muted }]}>
                  {origin.label} çevresi
                </Text>
                <Pressable onPress={picker.open} accessibilityRole="button" hitSlop={8}>
                  <Text style={[styles.changeCity, { color: theme.colors.primary }]}>
                    Farklı bir il seç
                  </Text>
                </Pressable>
              </View>
              {mapHref ? (
                <Pressable
                  onPress={() => router.push(mapHref)}
                  accessibilityRole="button"
                  style={({ pressed }) => [
                    styles.mapButton,
                    {
                      borderColor: theme.colors.border,
                      backgroundColor: theme.colors.surface,
                      borderRadius: theme.radius,
                      opacity: pressed ? 0.6 : 1,
                    },
                  ]}
                >
                  <Ionicons name="map-outline" size={16} color={theme.colors.primary} />
                  <Text style={[styles.mapButtonLabel, { color: theme.colors.text }]}>Harita</Text>
                </Pressable>
              ) : null}
            </View>

            <View>
              <SectionTitle theme={theme}>Uzmanlık alanı</SectionTitle>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.filterRow}
              >
                {FACILITY_TYPE_ORDER.map((type) => (
                  <Chip
                    key={type}
                    theme={theme}
                    label={FACILITY_TYPE_LABELS[type]}
                    selected={types.includes(type)}
                    onPress={() => toggleType(type)}
                  />
                ))}
              </ScrollView>
            </View>

            <View>
              <SectionTitle theme={theme}>Kurum türü</SectionTitle>
              <View style={styles.filterRow}>
                {OWNERSHIP_FILTERS.map((filter) => (
                  <Chip
                    key={filter.key}
                    theme={theme}
                    label={filter.label}
                    selected={ownership === filter.key}
                    onPress={() => setOwnership(filter.key)}
                  />
                ))}
              </View>
            </View>

            {loading ? (
              <View style={styles.loadingBox}>
                <ActivityIndicator color={theme.colors.primary} />
              </View>
            ) : null}
          </View>
        }
        ListEmptyComponent={
          loading ? undefined : failed ? (
            <EmptyState theme={theme} title="Kurumlar şu an yüklenemedi." />
          ) : (
            <EmptyState theme={theme} title={EMPTY_MESSAGE} />
          )
        }
      />
      <CityPickerModal
        visible={picker.visible}
        cities={picker.cities}
        selected={picker.selected}
        onSelect={handleCitySelect}
        onClose={picker.close}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  page: {
    flexGrow: 1,
  },
  list: {
    gap: 12,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  overline: {
    fontSize: 12,
    lineHeight: 18,
  },
  changeCity: {
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '600',
  },
  mapButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    paddingHorizontal: 12,
    height: 40,
  },
  mapButtonLabel: {
    fontSize: 14,
    lineHeight: 18,
  },
  filterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  loadingBox: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  heading: {
    fontSize: 24,
    fontWeight: '700',
    lineHeight: 32,
  },
  body: {
    marginTop: 16,
    fontSize: 15,
    lineHeight: 22,
  },
  note: {
    marginTop: 12,
    fontSize: 12,
    lineHeight: 18,
  },
});