import { useCallback, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Picker } from '@react-native-picker/picker';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../components/ThemeProvider';
import { Card, Chip, PrimaryButton, SectionTitle, inputStyle } from '../../components/ui';
import { deleteAllMyData } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { cancelAllNotifications, syncAllNotifications } from '../../lib/notifications';
import { useMemoryNotes, useSettings, type UserSettings } from '../../lib/supabase-hooks';
import { LOCAL_MODE } from '../../lib/mode';
import type { Theme, ThemeMode } from '../../lib/theme';

/** 08:00 – 23:30 arası yarım saatlik adımlar, `HH:MM` olarak saklanır. */
const CHECKIN_TIMES = Array.from({ length: 32 }, (_, index) => {
  const minutes = 8 * 60 + index * 30;
  const hours = String(Math.floor(minutes / 60)).padStart(2, '0');
  return `${hours}:${String(minutes % 60).padStart(2, '0')}`;
});

const THEME_MODES: { value: ThemeMode; label: string }[] = [
  { value: 'system', label: 'Sistem' },
  { value: 'light', label: 'Açık' },
  { value: 'dark', label: 'Karanlık' },
];

export default function ProfileScreen() {
  const { theme, mode, setMode } = useTheme();
  const insets = useSafeAreaInsets();
  const { user, profile, signOut, updateDisplayName, updateEmail } = useAuth();
  const { settings, update } = useSettings();
  const { notes } = useMemoryNotes();
  const [deleting, setDeleting] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [editingEmail, setEditingEmail] = useState(false);
  const [nameValue, setNameValue] = useState('');
  const [emailValue, setEmailValue] = useState('');
  const [error, setError] = useState('');

  /** Ayar değişimi önce DB'ye yazılır, sonra yerel bildirimler yeniden kurulur. */
  const applySettings = useCallback(
    async (patch: Partial<UserSettings>) => {
      await update(patch);
      if (user) await syncAllNotifications(user.id);
    },
    [update, user],
  );

  const handleSignOut = useCallback(async () => {
    await signOut();
    router.replace('/auth');
  }, [signOut]);

  const runDelete = useCallback(async () => {
    setDeleting(true);
    try {
      await deleteAllMyData();
    } catch {
      setDeleting(false);
      Alert.alert('Silinemedi', 'Verilerin şu an silinemedi. Lütfen biraz sonra tekrar dene.');
      return;
    }
    await cancelAllNotifications();
    await signOut();
    router.replace('/onboarding');
  }, [signOut]);

  const saveName = useCallback(async () => {
    const next = nameValue.trim();
    if (next.length === 0 || next.length > 40) {
      setError('İsim 1-40 karakter olmalı.');
      return;
    }
    setError('');
    const ok = await updateDisplayName(next);
    if (!ok) {
      setError('Kaydedilemedi. Lütfen tekrar dene.');
      return;
    }
    setEditingName(false);
  }, [nameValue, updateDisplayName]);

  const saveEmail = useCallback(async () => {
    const next = emailValue.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(next)) {
      setError('Geçerli bir e-posta adresi gir.');
      return;
    }
    setError('');
    try {
      await updateEmail(next);
    } catch {
      setError('E-posta değiştirilemedi. Bağlantıyı kontrol edip tekrar dene.');
      return;
    }
    setEditingEmail(false);
  }, [emailValue, updateEmail]);

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.colors.bg }}
      contentContainerStyle={[
        styles.content,
        { paddingBottom: insets.bottom + theme.spacing.xxl },
      ]}
    >
      <SectionTitle theme={theme}>Hesap</SectionTitle>
      <Card theme={theme} style={styles.card}>
        {error ? (
          <Text style={[styles.errorText, { color: theme.colors.danger }]}>{error}</Text>
        ) : null}
        {editingName ? (
          <View style={styles.editRow}>
            <TextInput
              value={nameValue}
              onChangeText={setNameValue}
              placeholder="Adını yaz"
              maxLength={40}
              autoCapitalize="words"
              style={[inputStyle(theme), styles.editInput]}
            />
            <Pressable
              onPress={() => void saveName()}
              accessibilityRole="button"
              style={[styles.saveChip, { backgroundColor: theme.colors.primary }]}
            >
              <Text style={[styles.saveText, { color: theme.colors.surface }]}>Kaydet</Text>
            </Pressable>
          </View>
        ) : (
          <Pressable
            onPress={() => {
              setError('');
              setNameValue(profile?.display_name ?? '');
              setEditingName(true);
            }}
            accessibilityRole="button"
            style={styles.editableRow}
          >
            <View style={styles.editableText}>
              <Text style={[styles.caption, { color: theme.colors.muted }]}>Görünen ad</Text>
              <Text style={[styles.rowLabel, { color: theme.colors.text }]}>
                {profile?.display_name ?? 'İsmini eklemedin'}
              </Text>
            </View>
            <Ionicons name="create-outline" size={18} color={theme.colors.muted} />
          </Pressable>
        )}
        {editingEmail ? (
          <View style={styles.editRow}>
            <TextInput
              value={emailValue}
              onChangeText={setEmailValue}
              placeholder="E-posta"
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              style={[inputStyle(theme), styles.editInput]}
            />
            <Pressable
              onPress={() => void saveEmail()}
              accessibilityRole="button"
              style={[styles.saveChip, { backgroundColor: theme.colors.primary }]}
            >
              <Text style={[styles.saveText, { color: theme.colors.surface }]}>Kaydet</Text>
            </Pressable>
          </View>
        ) : (
          <Pressable
            onPress={() => {
              setError('');
              setEmailValue(user?.email ?? '');
              setEditingEmail(true);
            }}
            accessibilityRole="button"
            style={styles.editableRow}
          >
            <View style={styles.editableText}>
              <Text style={[styles.caption, { color: theme.colors.muted }]}>E-posta</Text>
              <Text style={[styles.rowLabel, { color: theme.colors.text }]}>{user?.email ?? '—'}</Text>
            </View>
            <Ionicons name="create-outline" size={18} color={theme.colors.muted} />
          </Pressable>
        )}
        <InfoRow
          theme={theme}
          label="Mod"
          value={LOCAL_MODE ? 'Yerel — veriler yalnızca bu cihazda' : 'Supabase'}
        />
        {!LOCAL_MODE ? (
          <PrimaryButton
            theme={theme}
            label="Çıkış yap"
            variant="secondary"
            onPress={() => {
              void handleSignOut();
            }}
          />
        ) : null}
      </Card>

      <SectionTitle theme={theme}>DEVA'nın hatırladıkları</SectionTitle>
      <NavigationRow
        theme={theme}
        icon="bookmark-outline"
        label="Hatırladıkları"
        detail={`${notes.length} not`}
        onPress={() => router.push('/memory')}
      />

      <SectionTitle theme={theme}>Randevularım</SectionTitle>
      <NavigationRow
        theme={theme}
        icon="calendar-outline"
        label="Randevular"
        onPress={() => router.push('/appointments')}
      />

      <SectionTitle theme={theme}>Bildirimler</SectionTitle>
      <Card theme={theme} style={styles.card}>
        <ToggleRow
          theme={theme}
          label={'Günlük "nasılsın?"'}
          value={settings?.daily_checkin_enabled ?? true}
          onValueChange={(value) => {
            void applySettings({ daily_checkin_enabled: value });
          }}
        />
        <View style={styles.pickerBlock}>
          <Text style={[styles.caption, { color: theme.colors.muted }]}>Soru saati</Text>
          <View
            style={[
              styles.pickerBox,
              { borderColor: theme.colors.border, borderRadius: theme.radius },
            ]}
          >
            <Picker
              selectedValue={settings?.daily_checkin_time ?? '20:00'}
              onValueChange={(value: string) => {
                void applySettings({ daily_checkin_time: value });
              }}
              dropdownIconColor={theme.colors.muted}
              style={[styles.picker, { color: theme.colors.text }]}
              itemStyle={{ color: theme.colors.text }}
            >
              {CHECKIN_TIMES.map((time) => (
                <Picker.Item key={time} label={time} value={time} />
              ))}
            </Picker>
          </View>
        </View>
        <ToggleRow
          theme={theme}
          label="Kriz sonrası yoklamalar"
          value={settings?.post_crisis_followup_enabled ?? true}
          onValueChange={(value) => {
            void applySettings({ post_crisis_followup_enabled: value });
          }}
        />
      </Card>

      <SectionTitle theme={theme}>Görünüm</SectionTitle>
      <View style={styles.chipRow}>
        {THEME_MODES.map((option) => (
          <Chip
            key={option.value}
            theme={theme}
            label={option.label}
            selected={option.value === mode}
            onPress={() => {
              void setMode(option.value);
            }}
          />
        ))}
      </View>

      <SectionTitle theme={theme}>Kullanım Şartları ve KVKK</SectionTitle>
      <NavigationRow
        theme={theme}
        icon="document-text-outline"
        label="Kullanım şartları ve KVKK metni"
        onPress={() => router.push('/terms')}
      />

      <SectionTitle theme={theme}>Verilerin</SectionTitle>
      <PrimaryButton
        theme={theme}
        label="Tüm verilerimi sil"
        variant="danger"
        busy={deleting}
        onPress={() =>
          Alert.alert(
            'Tüm verilerini sil',
            "Sohbet geçmişin, anket sonuçların ve DEVA'nın senden hatırladıkları kalıcı olarak silinecek. Bu işlem geri alınamaz.",
            [
              { text: 'Vazgeç', style: 'cancel' },
              { text: 'Sil', style: 'destructive', onPress: () => void runDelete() },
            ],
          )
        }
      />
    </ScrollView>
  );
}

function InfoRow({ theme, label, value }: { theme: Theme; label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Text style={[styles.caption, { color: theme.colors.muted }]}>{label}</Text>
      <Text style={[styles.rowLabel, { color: theme.colors.text }]}>{value}</Text>
    </View>
  );
}

function NavigationRow({
  theme,
  icon,
  label,
  detail,
  onPress,
}: {
  theme: Theme;
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  detail?: string;
  onPress: () => void;
}) {
  return (
    <Card theme={theme} style={styles.navCard}>
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        style={({ pressed }) => [styles.navRow, { opacity: pressed ? 0.6 : 1 }]}
      >
        <Ionicons name={icon} size={20} color={theme.colors.muted} />
        <Text style={[styles.rowLabel, { color: theme.colors.text }]}>{label}</Text>
        {detail ? (
          <Text style={[styles.caption, { color: theme.colors.muted }]}>{detail}</Text>
        ) : null}
        <Ionicons name="chevron-forward" size={18} color={theme.colors.muted} />
      </Pressable>
    </Card>
  );
}

function ToggleRow({
  theme,
  label,
  value,
  onValueChange,
}: {
  theme: Theme;
  label: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
}) {
  return (
    <View style={styles.toggleRow}>
      <Text style={[styles.rowLabel, { color: theme.colors.text }]}>{label}</Text>
      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{ true: theme.colors.primary, false: theme.colors.border }}
        thumbColor={theme.colors.surface}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: 24,
    gap: 12,
  },
  card: {
    gap: 16,
  },
  navCard: {
    paddingVertical: 4,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingVertical: 6,
  },
  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
  },
  infoRow: {
    gap: 4,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  pickerBlock: {
    gap: 8,
  },
  pickerBox: {
    borderWidth: 1,
    overflow: 'hidden',
  },
  picker: {
    height: 52,
  },
  rowLabel: {
    flex: 1,
    fontSize: 15,
    lineHeight: 22,
  },
  editRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  editInput: {
    flex: 1,
  },
  editableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  editableText: {
    flex: 1,
    gap: 4,
  },
  saveChip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 999,
  },
  saveText: {
    fontSize: 14,
    fontWeight: '600',
  },
  errorText: {
    fontSize: 13,
  },
  caption: {
    fontSize: 12,
  },
});
