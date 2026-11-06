import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Linking, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../components/ThemeProvider';
import { EmptyState, PrimaryButton } from '../../components/ui';
import {
  FacilityCard,
  openStreetMapUrl,
  type Facility,
} from '../../components/facility/FacilityCard';
import { loadGoogleMapsView, mapsUnavailableReason } from '../../lib/maps';
import { loadNearbyFacilities, type FacilityQuery } from './index';

export default function FacilityMapScreen() {
  const { theme } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams();

  const rawLat = Array.isArray(params.lat) ? params.lat[0] : params.lat;
  const rawLng = Array.isArray(params.lng) ? params.lng[0] : params.lng;
  const lat = Number(rawLat);
  const lng = Number(rawLng);
  const hasPoint = Number.isFinite(lat) && Number.isFinite(lng);

  const [facilities, setFacilities] = useState<Facility[]>([]);
  const [loading, setLoading] = useState(hasPoint);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!hasPoint) return;
    let active = true;
    setLoading(true);
    const query: FacilityQuery = { lat, lng, types: [], ownership: 'all' };
    loadNearbyFacilities(query)
      .then((rows) => {
        if (!active) return;
        setFacilities(rows);
        setFailed(false);
      })
      .catch(() => {
        if (!active) return;
        setFacilities([]);
        setFailed(true);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [hasPoint, lat, lng]);

  const MapView = useMemo(() => loadGoogleMapsView(), []);

  const markers = useMemo(
    () =>
      facilities.map((facility) => ({
        id: facility.id,
        coordinates: { latitude: facility.lat, longitude: facility.lng },
        title: facility.name,
      })),
    [facilities],
  );

  if (!hasPoint) {
    return (
      <View style={[styles.flex, { backgroundColor: theme.colors.bg, padding: theme.spacing.xl }]}>
        <EmptyState
          theme={theme}
          title="Harita için bir konum gerekiyor"
          body="Önce kurumlar listesinden bir il seç ya da kendi konumunu kullan."
        />
        <View style={{ marginTop: theme.spacing.lg }}>
          <PrimaryButton
            theme={theme}
            label="Kurumlara dön"
            onPress={() => router.replace('/facilities')}
          />
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.flex, { backgroundColor: theme.colors.bg }]}>
      {MapView ? (
        <View style={styles.mapArea}>
          <MapView
            style={styles.flex}
            cameraPosition={{ coordinates: { latitude: lat, longitude: lng }, zoom: 12 }}
            markers={markers}
            onMarkerClick={(marker) => {
              if (marker.id) router.push(`/facilities/${marker.id}`);
            }}
          />
        </View>
      ) : (
        <View
          style={[
            styles.notice,
            { backgroundColor: theme.colors.surfaceAlt, borderRadius: theme.radius },
          ]}
        >
          <Text style={[styles.noticeText, { color: theme.colors.muted }]}>
            {mapsUnavailableReason()}
          </Text>
        </View>
      )}

      {loading ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator color={theme.colors.primary} />
        </View>
      ) : null}

      <FlatList
        style={styles.flex}
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
            onOpenMap={() => {
              void Linking.openURL(openStreetMapUrl(item));
            }}
          />
        )}
        ListEmptyComponent={
          loading ? undefined : failed ? (
            <EmptyState theme={theme} title="Kurumlar şu an yüklenemedi." />
          ) : (
            <EmptyState
              theme={theme}
              title="Bu bölgede kayıtlı bir kurum yok. Farklı bir il seçebilirsin."
            />
          )
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  mapArea: {
    height: 320,
  },
  notice: {
    margin: 16,
    padding: 12,
  },
  noticeText: {
    fontSize: 12,
    lineHeight: 18,
  },
  loadingBox: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  list: {
    gap: 12,
  },
});