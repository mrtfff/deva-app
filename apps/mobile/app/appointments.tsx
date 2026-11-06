import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../components/ThemeProvider';
import { Card, EmptyState, inputStyle, PrimaryButton, SectionTitle } from '../components/ui';
import { useAuth } from '../lib/auth';
import {
  cancelAppointmentReminder,
  scheduleAppointmentReminder,
  syncAllNotifications,
} from '../lib/notifications';
import { supabase } from '../lib/supabase';
import { useAppointments } from '../lib/supabase-hooks';
import type { Appointment } from '../lib/supabase-hooks';

const ONE_HOUR_MS = 60 * 60 * 1000;
const FACILITY_LIMIT = 50;

type Mode = 'list' | 'form';
type PickerMode = 'date' | 'time';

/** `nearby_facilities` RPC'sinden gelen, formda kullanılan alanlar. */
interface FacilityOption {
  id: string;
  name: string;
  city: string | null;
  district: string | null;
}

/** Her zaman gelecekte olan bir başlangıç: bir sonraki tam saat. */
function nextFullHour(): Date {
  const date = new Date(Date.now() + ONE_HOUR_MS);
  date.setMinutes(0, 0, 0);
  return date;
}

export default function AppointmentsScreen() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { appointments, loading, create, remove, toggleReminder } = useAppointments();

  const params = useLocalSearchParams();
  const facilityIdParam =
    (Array.isArray(params.facilityId) ? params.facilityId[0] : params.facilityId) ?? '';
  const facilityNameParam =
    (Array.isArray(params.facilityName) ? params.facilityName[0] : params.facilityName) ?? '';

  const todayStart = useMemo(() => {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    return date;
  }, []);

  const [mode, setMode] = useState<Mode>(facilityNameParam ? 'form' : 'list');

  const [title, setTitle] = useState(facilityNameParam);
  const [facilityId, setFacilityId] = useState<string | null>(facilityIdParam || null);
  const [facilityName, setFacilityName] = useState(facilityNameParam);
  const [when, setWhen] = useState<Date>(nextFullHour);
  const [picker, setPicker] = useState<PickerMode | null>(null);
  const [remindEnabled, setRemindEnabled] = useState(true);
  const [notes, setNotes] = useState('');
  const [query, setQuery] = useState('');
  const [options, setOptions] = useState<FacilityOption[]>([]);
  const [searching, setSearching] = useState(false);
  const [saving, setSaving] = useState(false);

  // Kurum detayından "Randevumu ekle" ile gelindiğinde form hazır gelir.
  useEffect(() => {
    if (!facilityNameParam) return;
    setFacilityId(facilityIdParam || null);
    setFacilityName(facilityNameParam);
    setTitle(facilityNameParam);
    setMode('form');
  }, [facilityIdParam, facilityNameParam]);

  const filteredOptions = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase('tr');
    if (!needle) return options;
    return options.filter((option) => option.name.toLocaleLowerCase('tr').includes(needle));
  }, [options, query]);

  const hasCoordinates = options.length > 0;

  function resetForm() {
    setTitle(facilityNameParam);
    setFacilityId(facilityIdParam || null);
    setFacilityName(facilityNameParam);
    setWhen(nextFullHour());
    setPicker(null);
    setRemindEnabled(true);
    setNotes('');
    setQuery('');
    setOptions([]);
  }

  function handleFacilityNameChange(value: string) {
    setFacilityName(value);
    setFacilityId(null);
  }

  function chooseFacility(option: FacilityOption) {
    setFacilityId(option.id);
    setFacilityName(option.name);
    setTitle((current) => (current.trim() ? current : option.name));
    setQuery('');
  }

  async function searchNearbyFacilities() {
    setSearching(true);
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (!permission.granted) {
        Alert.alert(
          'Konum izni',
          'Yakınındaki kurumları aramak için konum izni gerekiyor. İstersen kurum adını elle yazabilirsin.',
        );
        return;
      }

      const position = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      const { data, error } = await supabase.rpc('nearby_facilities', {
        p_lat: position.coords.latitude,
        p_lng: position.coords.longitude,
        p_limit: FACILITY_LIMIT,
      });
      if (error) throw new Error(error.message);

      const rows = Array.isArray(data) ? (data as FacilityOption[]) : [];
      setOptions(rows);
      if (rows.length === 0) {
        Alert.alert(
          'Sonuç bulunamadı',
          'Yakınında kayıtlı bir kurum görünmüyor. Kurum adını elle yazabilirsin.',
        );
      }
    } catch {
      Alert.alert(
        'Kurumlar bulunamadı',
        'Şu an kurum araması yapılamadı. Kurum adını elle yazabilirsin.',
      );
    } finally {
      setSearching(false);
    }
  }

  function applyPickedValue(kind: PickerMode, selected: Date) {
    setWhen((current) => {
      const next = new Date(current.getTime());
      if (kind === 'date') {
        next.setFullYear(selected.getFullYear(), selected.getMonth(), selected.getDate());
      } else {
        next.setHours(selected.getHours(), selected.getMinutes(), 0, 0);
      }
      return next;
    });
    // Android'de seçim diyaloğu kendiliğinden kapanır.
    if (Platform.OS !== 'ios') setPicker(null);
  }

  async function handleToggleReminder(appointment: Appointment, next: boolean) {
    await toggleReminder(appointment.id, next);
    if (next) {
      await scheduleAppointmentReminder({
        id: appointment.id,
        title: appointment.title,
        starts_at: appointment.starts_at,
        remind_at: appointment.remind_at,
        remind_enabled: next,
      });
    } else {
      await cancelAppointmentReminder(appointment.id);
    }
  }

  async function deleteAppointment(id: string) {
    await remove(id);
    await cancelAppointmentReminder(id);
  }

  function confirmDelete(appointment: Appointment) {
    Alert.alert('Randevuyu sil', `"${appointment.title}" silinsin mi?`, [
      { text: 'Vazgeç', style: 'cancel' },
      {
        text: 'Sil',
        style: 'destructive',
        onPress: () => {
          void deleteAppointment(appointment.id);
        },
      },
    ]);
  }

  async function save() {
    const cleanTitle = title.trim();
    if (!cleanTitle) {
      Alert.alert('Başlık gerekli', 'Randevu için kısa bir başlık yazabilirsin.');
      return;
    }
    if (when.getTime() <= Date.now()) {
      Alert.alert('Geçmiş bir tarih', 'Lütfen gelecekte bir randevu saati seç.');
      return;
    }

    setSaving(true);
    try {
      const startsAt = when.toISOString();
      const remindAt = new Date(when.getTime() - ONE_HOUR_MS).toISOString();
      const id = await create({
        facility_id: facilityId,
        title: cleanTitle,
        starts_at: startsAt,
        remind_at: remindAt,
        remind_enabled: remindEnabled,
        notes: notes.trim() ? notes.trim() : null,
      });
      if (!id) {
        Alert.alert('Kaydedilemedi', 'Randevu kaydedilemedi. Biraz sonra tekrar deneyebilirsin.');
        return;
      }

      if (remindEnabled) {
        await scheduleAppointmentReminder({
          id,
          title: cleanTitle,
          starts_at: startsAt,
          remind_at: remindAt,
          remind_enabled: remindEnabled,
        });
      }
      if (user) await syncAllNotifications(user.id);

      resetForm();
      setMode('list');
    } catch {
      Alert.alert('Kaydedilemedi', 'Randevu kaydedilemedi. Biraz sonra tekrar deneyebilirsin.');
    } finally {
      setSaving(false);
    }
  }

  function renderList() {
    return (
      <View>
        <PrimaryButton
          theme={theme}
          label="+ Randevu ekle"
          onPress={() => setMode('form')}
        />

        {loading && appointments.length === 0 ? (
          <ActivityIndicator color={theme.colors.primary} style={styles.loader} />
        ) : null}

        {appointments.length === 0 && !loading ? (
          <EmptyState theme={theme} title="Henüz randevun yok. Randevu ekleyebilirsin." />
        ) : null}

        {appointments.map((appointment) => (
          <Card key={appointment.id} theme={theme} style={styles.card}>
            <View style={styles.cardHead}>
              <Text style={[styles.cardTitle, { color: theme.colors.text }]}>
                {appointment.title}
              </Text>
              <Switch
                value={appointment.remind_enabled}
                onValueChange={(next) => {
                  void handleToggleReminder(appointment, next);
                }}
                trackColor={{ false: theme.colors.border, true: theme.colors.primary }}
                thumbColor={theme.colors.surface}
              />
            </View>

            <Text style={[styles.cardMeta, { color: theme.colors.muted }]}>
              {new Date(appointment.starts_at).toLocaleString('tr-TR')}
            </Text>

            {appointment.facility_name ? (
              <Text style={[styles.cardMeta, { color: theme.colors.muted }]}>
                {appointment.facility_name}
              </Text>
            ) : null}

            <View style={styles.cardActions}>
              <Pressable
                onPress={() => confirmDelete(appointment)}
                accessibilityRole="button"
                style={styles.action}
              >
                <Ionicons name="trash-outline" size={16} color={theme.colors.danger} />
                <Text style={[styles.actionLabel, { color: theme.colors.danger }]}>Sil</Text>
              </Pressable>
            </View>
          </Card>
        ))}
      </View>
    );
  }

  function renderForm() {
    return (
      <View>
        <Pressable
          onPress={() => setMode('list')}
          accessibilityRole="button"
          style={styles.back}
        >
          <Ionicons name="chevron-back" size={18} color={theme.colors.muted} />
          <Text style={[styles.backLabel, { color: theme.colors.muted }]}>Listeye dön</Text>
        </Pressable>

        <SectionTitle theme={theme}>Randevu ekle</SectionTitle>

        <Card theme={theme} style={styles.form}>
          <Text style={[styles.label, { color: theme.colors.muted }]}>Başlık</Text>
          <TextInput
            value={title}
            onChangeText={setTitle}
            placeholder="Örn. Psikolog randevusu"
            placeholderTextColor={theme.colors.muted}
            style={inputStyle(theme)}
          />

          <Text style={[styles.label, { color: theme.colors.muted }]}>
            Kurum (isteğe bağlı)
          </Text>
          <TextInput
            value={facilityName}
            onChangeText={handleFacilityNameChange}
            placeholder="Kurum adı"
            placeholderTextColor={theme.colors.muted}
            style={inputStyle(theme)}
          />

          {hasCoordinates ? (
            <>
              <TextInput
                value={query}
                onChangeText={setQuery}
                placeholder="Listeden ara"
                placeholderTextColor={theme.colors.muted}
                autoCorrect={false}
                style={[inputStyle(theme), styles.search]}
              />
              {filteredOptions.slice(0, 8).map((option) => (
                <Pressable
                  key={option.id}
                  onPress={() => chooseFacility(option)}
                  accessibilityRole="button"
                  style={({ pressed }) => [
                    styles.option,
                    { borderColor: theme.colors.border, opacity: pressed ? 0.6 : 1 },
                  ]}
                >
                  <Text style={[styles.optionName, { color: theme.colors.text }]}>
                    {option.name}
                  </Text>
                  <Text style={[styles.optionMeta, { color: theme.colors.muted }]}>
                    {[option.district, option.city].filter(Boolean).join(' / ')}
                  </Text>
                </Pressable>
              ))}
            </>
          ) : (
            <Pressable
              onPress={() => {
                void searchNearbyFacilities();
              }}
              accessibilityRole="button"
              style={styles.nearby}
            >
              {searching ? (
                <ActivityIndicator color={theme.colors.primary} />
              ) : (
                <>
                  <Ionicons name="search-outline" size={16} color={theme.colors.primary} />
                  <Text style={[styles.nearbyLabel, { color: theme.colors.primary }]}>
                    Yakınımdaki kurumlar
                  </Text>
                </>
              )}
            </Pressable>
          )}

          <Text style={[styles.label, { color: theme.colors.muted }]}>Tarih</Text>
          <Pressable
            onPress={() => setPicker('date')}
            accessibilityRole="button"
            style={[styles.pickerRow, { borderColor: theme.colors.border }]}
          >
            <Text style={[styles.pickerValue, { color: theme.colors.text }]}>
              {when.toLocaleDateString('tr-TR')}
            </Text>
          </Pressable>

          <Text style={[styles.label, { color: theme.colors.muted }]}>Saat</Text>
          <Pressable
            onPress={() => setPicker('time')}
            accessibilityRole="button"
            style={[styles.pickerRow, { borderColor: theme.colors.border }]}
          >
            <Text style={[styles.pickerValue, { color: theme.colors.text }]}>
              {when.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}
            </Text>
          </Pressable>

          {picker === 'date' ? (
            <View style={styles.pickerBlock}>
              <DateTimePicker
                value={when}
                mode="date"
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                minimumDate={todayStart}
                onValueChange={(_event, selected) => applyPickedValue('date', selected)}
                onDismiss={() => setPicker(null)}
              />
              {Platform.OS === 'ios' ? (
                <Pressable onPress={() => setPicker(null)} style={styles.pickerDone}>
                  <Text style={{ color: theme.colors.primary }}>Bitti</Text>
                </Pressable>
              ) : null}
            </View>
          ) : null}

          {picker === 'time' ? (
            <View style={styles.pickerBlock}>
              <DateTimePicker
                value={when}
                mode="time"
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                onValueChange={(_event, selected) => applyPickedValue('time', selected)}
                onDismiss={() => setPicker(null)}
              />
              {Platform.OS === 'ios' ? (
                <Pressable onPress={() => setPicker(null)} style={styles.pickerDone}>
                  <Text style={{ color: theme.colors.primary }}>Bitti</Text>
                </Pressable>
              ) : null}
            </View>
          ) : null}

          <View style={styles.switchRow}>
            <Text style={[styles.switchLabel, { color: theme.colors.text }]}>
              1 saat önce hatırlat
            </Text>
            <Switch
              value={remindEnabled}
              onValueChange={setRemindEnabled}
              trackColor={{ false: theme.colors.border, true: theme.colors.primary }}
              thumbColor={theme.colors.surface}
            />
          </View>

          <Text style={[styles.label, { color: theme.colors.muted }]}>Not</Text>
          <TextInput
            value={notes}
            onChangeText={setNotes}
            placeholder="Kısaca not etmek istersen"
            placeholderTextColor={theme.colors.muted}
            multiline
            numberOfLines={3}
            textAlignVertical="top"
            style={[inputStyle(theme), styles.notes]}
          />

          <View style={{ marginTop: theme.spacing.xl }}>
            <PrimaryButton theme={theme} label="Randevuyu kaydet" onPress={save} busy={saving} />
          </View>
        </Card>
      </View>
    );
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.colors.bg }}
      contentContainerStyle={[
        styles.container,
        { paddingBottom: insets.bottom + theme.spacing.xxl },
      ]}
      keyboardShouldPersistTaps="handled"
    >
      {mode === 'list' ? renderList() : renderForm()}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  loader: {
    marginTop: 24,
  },
  card: {
    marginTop: 12,
  },
  cardHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cardTitle: {
    flex: 1,
    fontSize: 17,
    fontWeight: '600',
    marginRight: 12,
  },
  cardMeta: {
    fontSize: 12,
    marginTop: 6,
  },
  cardActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 12,
  },
  action: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  actionLabel: {
    fontSize: 15,
    marginLeft: 6,
  },
  back: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  backLabel: {
    fontSize: 15,
  },
  form: {
    marginBottom: 24,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginTop: 16,
    marginBottom: 8,
  },
  search: {
    marginTop: 12,
  },
  option: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginTop: 8,
  },
  optionName: {
    fontSize: 15,
    fontWeight: '600',
  },
  optionMeta: {
    fontSize: 12,
    marginTop: 2,
  },
  nearby: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    minHeight: 32,
  },
  nearbyLabel: {
    fontSize: 15,
    marginLeft: 8,
  },
  pickerRow: {
    height: 52,
    borderWidth: 1,
    borderRadius: 18,
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  pickerValue: {
    fontSize: 15,
  },
  pickerBlock: {
    marginTop: 8,
  },
  pickerDone: {
    alignSelf: 'flex-end',
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 20,
  },
  switchLabel: {
    fontSize: 15,
  },
  notes: {
    height: 96,
    paddingTop: 12,
  },
});