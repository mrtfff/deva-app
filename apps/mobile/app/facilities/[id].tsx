import { useEffect, useState } from 'react';
import { ActivityIndicator, Linking, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../components/ThemeProvider';
import { Card, EmptyState, PrimaryButton } from '../../components/ui';
import type { Theme } from '../../lib/theme';
import {
  FACILITY_GENDER_LABELS,
  FACILITY_OWNERSHIP_LABELS,
  FACILITY_PRICE_LABELS,
  FACILITY_TYPE_LABELS,
  directionsUrl,
  facilityAddressLine,
  type FacilityBase,
} from '../../components/facility/FacilityCard';
import { supabase } from '../../lib/supabase';

const LANGUAGE_LABELS: Record<string, string> = {
  tr: 'Türkçe',
  en: 'İngilizce',
  ar: 'Arapça',
  de: 'Almanca',
  fr: 'Fransızca',
  ru: 'Rusça',
};

const DAY_ORDER: { aliases: string[]; label: string }[] = [
  { aliases: ['pzt', 'pazartesi'], label: 'Pzt' },
  { aliases: ['sal', 'salı'], label: 'Sal' },
  { aliases: ['çar', 'çarşamba'], label: 'Çar' },
  { aliases: ['per', 'perşembe'], label: 'Per' },
  { aliases: ['cum', 'cuma'], label: 'Cum' },
  { aliases: ['cmt', 'cumartesi'], label: 'Cmt' },
  { aliases: ['paz', 'pazar'], label: 'Paz' },
];

const FACILITY_FIELDS =
  'id, slug, name, type, ownership, city, district, address, phone, website, languages, gender, is_online, price_range, working_hours, accepting_patients, lat, lng';

function dayLabel(key: string): { label: string; order: number } {
  const normalized = key.toLowerCase().replace(/[.\s]/g, '');
  const index = DAY_ORDER.findIndex((day) => day.aliases.includes(normalized));
  return index >= 0
    ? { label: DAY_ORDER[index].label, order: index }
    : { label: key, order: DAY_ORDER.length };
}

/** "Pzt": "09:00-17:00" biçimindeki jsonb'yi "Pzt–Cum 09:00–17:00" satırlarına çevirir. */
function formatWorkingHours(hours: Record<string, string> | null): string[] {
  if (!hours) return [];
  const entries = Object.entries(hours).filter(
    ([, value]) => typeof value === 'string' && value.trim() !== '',
  );
  if (entries.length === 0) return [];

  const sorted = [...entries].sort(([a], [b]) => dayLabel(a).order - dayLabel(b).order);
  const lines: string[] = [];
  let start = '';
  let end = '';
  let range = '';

  for (const [key, value] of sorted) {
    const { label } = dayLabel(key);
    const nextRange = value.trim().replace(/\s*-\s*/g, '–');
    if (start === '') {
      start = label;
      end = label;
      range = nextRange;
      continue;
    }
    if (nextRange === range) {
      end = label;
      continue;
    }
    lines.push(start === end ? `${start} ${range}` : `${start}–${end} ${range}`);
    start = label;
    end = label;
    range = nextRange;
  }
  if (start !== '') {
    lines.push(start === end ? `${start} ${range}` : `${start}–${end} ${range}`);
  }

  return lines;
}

function DetailRow({ theme, label, value }: { theme: Theme; label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={[styles.rowLabel, { color: theme.colors.muted }]}>{label}</Text>
      <Text style={[styles.rowValue, { color: theme.colors.text }]}>{value}</Text>
    </View>
  );
}

export default function FacilityDetailScreen() {
  const { theme } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;

  const [facility, setFacility] = useState<FacilityBase | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) {
      setLoading(false);
      return;
    }
    let active = true;
    setLoading(true);
    supabase
      .from('facilities')
      .select(FACILITY_FIELDS)
      .eq('id', id)
      .maybeSingle()
      .then(({ data }) => {
        if (!active) return;
        setFacility((data as FacilityBase | null) ?? null);
        setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [id]);

  if (loading) {
    return (
      <View style={[styles.centered, { backgroundColor: theme.colors.bg }]}>
        <ActivityIndicator color={theme.colors.primary} />
      </View>
    );
  }

  if (!facility) {
    return (
      <View style={[styles.centered, { backgroundColor: theme.colors.bg, padding: theme.spacing.xl }]}>
        <EmptyState
          theme={theme}
          title="Bu kurum bulunamadı"
          body="Kayıt kaldırılmış ya da adres değişmiş olabilir."
        />
      </View>
    );
  }

  const workingHours = formatWorkingHours(facility.working_hours);
  const languages = (facility.languages ?? [])
    .map((code) => LANGUAGE_LABELS[code.toLowerCase()] ?? code.toUpperCase())
    .join(', ');

  return (
    <ScrollView
      style={{ backgroundColor: theme.colors.bg }}
      contentContainerStyle={[
        styles.page,
        { padding: theme.spacing.lg, paddingBottom: insets.bottom + theme.spacing.xl },
      ]}
    >
      <Text style={[styles.name, { color: theme.colors.text }]}>{facility.name}</Text>
      <Text style={[styles.subtitle, { color: theme.colors.muted }]}>
        {FACILITY_TYPE_LABELS[facility.type]} · {FACILITY_OWNERSHIP_LABELS[facility.ownership]}
      </Text>

      <Card theme={theme} style={{ marginTop: theme.spacing.lg }}>
        <DetailRow theme={theme} label="Adres" value={facilityAddressLine(facility)} />
        <DetailRow
          theme={theme}
          label="Çalışma saatleri"
          value={workingHours.length > 0 ? workingHours.join('\n') : 'Belirtilmemiş'}
        />
        <DetailRow theme={theme} label="Konuşma dili" value={languages || 'Belirtilmemiş'} />
        <DetailRow
          theme={theme}
          label="Cinsiyet"
          value={facility.gender ? FACILITY_GENDER_LABELS[facility.gender] : 'Belirtilmemiş'}
        />
        <DetailRow
          theme={theme}
          label="Online seans"
          value={facility.is_online ? 'Var' : 'Yok'}
        />
        <DetailRow
          theme={theme}
          label="Ücret aralığı"
          value={facility.price_range ? FACILITY_PRICE_LABELS[facility.price_range] : 'Belirtilmemiş'}
        />
        <DetailRow
          theme={theme}
          label="Yeni hasta"
          value={facility.accepting_patients ? 'Kabul ediliyor' : 'Şu an kabul edilmiyor'}
        />
        <DetailRow
          theme={theme}
          label="Telefon"
          value={facility.phone ?? 'Belirtilmemiş'}
        />
      </Card>

      {facility.website ? (
        <View style={{ marginTop: theme.spacing.md }}>
          <PrimaryButton
            theme={theme}
            variant="secondary"
            label="Site aç"
            onPress={() => {
              void Linking.openURL(facility.website as string);
            }}
          />
        </View>
      ) : null}

      <View style={[styles.actions, { marginTop: theme.spacing.xl }]}>
        {facility.phone ? (
          <PrimaryButton
            theme={theme}
            label="Ara"
            onPress={() => {
              void Linking.openURL(`tel:${facility.phone}`);
            }}
          />
        ) : null}
        <PrimaryButton
          theme={theme}
          variant="secondary"
          label="Yol tarifi"
          onPress={() => {
            void Linking.openURL(directionsUrl(facility));
          }}
        />
      </View>

      <View style={{ marginTop: theme.spacing.md }}>
        <PrimaryButton
          theme={theme}
          label="Randevumu ekle"
          onPress={() =>
            router.push(
              `/appointments?facilityId=${encodeURIComponent(facility.id)}&facilityName=${encodeURIComponent(facility.name)}`,
            )
          }
        />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: {
    flexGrow: 1,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  name: {
    fontSize: 22,
    fontWeight: '700',
    lineHeight: 30,
  },
  subtitle: {
    marginTop: 4,
    fontSize: 13,
    lineHeight: 19,
  },
  row: {
    paddingVertical: 8,
  },
  rowLabel: {
    fontSize: 12,
    lineHeight: 18,
  },
  rowValue: {
    marginTop: 2,
    fontSize: 15,
    lineHeight: 22,
  },
  actions: {
    gap: 8,
  },
});