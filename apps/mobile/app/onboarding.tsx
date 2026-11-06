import { useMemo, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../lib/auth';
import { useTheme } from '../components/ThemeProvider';
import { Card, inputStyle, PrimaryButton } from '../components/ui';
import { DISCLAIMER, TERMS_VERSION } from '../lib/legal';
import { requestNotificationPermission } from '../lib/notifications';
import { supabase } from '../lib/supabase';

const STEP_COUNT = 4;
const MIN_AGE = 18;
const MAX_AGE_RANGE = 80;

export default function OnboardingScreen() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const { user, refreshProfile } = useAuth();

  const [step, setStep] = useState(0);
  const [accepted, setAccepted] = useState(false);
  const [nickname, setNickname] = useState('');
  const [birthYear, setBirthYear] = useState<number | null>(null);
  const [dailyCheckin, setDailyCheckin] = useState(true);
  const [saving, setSaving] = useState(false);

  const currentYear = new Date().getFullYear();

  const years = useMemo(() => {
    const list: number[] = [];
    for (let year = currentYear - MIN_AGE; year >= currentYear - MAX_AGE_RANGE; year -= 1) {
      list.push(year);
    }
    return list;
  }, [currentYear]);

  if (!user) return null;

  const isLastStep = step === STEP_COUNT - 1;
  const requirementMet =
    step === 1 ? accepted : step === 2 ? birthYear !== null : true;
  const canContinue = requirementMet && !saving;

  function continueFlow() {
    if (!canContinue) return;

    if (step === 2) {
      if (birthYear !== null && currentYear - birthYear < MIN_AGE) {
        Alert.alert(
          'DEVA 18 yaş ve üzeri kullanıcılar içindir.',
          'Doğum yılını kontrol edebilir misin? Devam etmek için 18 yaş ve üzeri olmalısın.',
        );
        return;
      }
      setStep(3);
      return;
    }

    if (!isLastStep) {
      setStep(step + 1);
      return;
    }

    void finish();
  }

  async function finish() {
    if (!user || birthYear === null || saving) return;

    setSaving(true);
    const displayName = nickname.trim().length > 0 ? nickname.trim() : null;

    try {
      if (dailyCheckin) {
        await requestNotificationPermission();
      }

      await supabase.from('profiles').upsert({
        id: user.id,
        display_name: displayName,
        birth_year: birthYear,
        onboarding_completed: true,
      });
      await supabase
        .from('user_settings')
        .upsert({ user_id: user.id, daily_checkin_enabled: dailyCheckin });
      await supabase
        .from('consent')
        .upsert({ user_id: user.id, terms_version: TERMS_VERSION });

      await refreshProfile();
      router.replace('/(tabs)');
    } catch {
      Alert.alert(
        'Bir sorun çıktı',
        'Bilgilerini kaydedemedim. Lütfen tekrar dene.',
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: theme.colors.bg }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: insets.top + theme.spacing.lg,
            paddingBottom: insets.bottom + theme.spacing.xl,
          },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.progressRow} accessibilityRole="progressbar">
          {Array.from({ length: STEP_COUNT }, (_unused, index) => (
            <View
              key={index}
              style={[
                styles.progressSegment,
                {
                  backgroundColor:
                    index <= step ? theme.colors.primary : theme.colors.surfaceAlt,
                },
              ]}
            />
          ))}
          <Text style={[styles.progressLabel, { color: theme.colors.muted }]}>
            {step + 1} / {STEP_COUNT}
          </Text>
        </View>

        {step === 0 ? (
          <View style={styles.block}>
            <Text style={[styles.heading, { color: theme.colors.text }]}>
              DEVA burada seni dinlemek için var.
            </Text>
            <Text style={[styles.sub, { color: theme.colors.muted }]}>
              DEVA tanı koymaz, tedavi yerine geçmez.
            </Text>
          </View>
        ) : null}

        {step === 1 ? (
          <View style={styles.block}>
            <Text style={[styles.heading, { color: theme.colors.text }]}>
              Önce bir uyarı
            </Text>
            <Card theme={theme} style={{ marginTop: theme.spacing.lg }}>
              <Text style={{ color: theme.colors.text, fontSize: theme.type.body, lineHeight: theme.type.bodyLineHeight }}>
                {DISCLAIMER}
              </Text>
            </Card>

            <Pressable
              onPress={() => setAccepted(!accepted)}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: accepted }}
              accessibilityLabel="Okudum, kabul ediyorum."
              style={styles.checkboxRow}
            >
              <View
                style={[
                  styles.checkboxBox,
                  {
                    borderColor: accepted ? theme.colors.primary : theme.colors.border,
                    backgroundColor: accepted ? theme.colors.primary : theme.colors.surface,
                  },
                ]}
              >
                {accepted ? (
                  <Ionicons name="checkmark" size={18} color={theme.colors.surface} />
                ) : (
                  <Ionicons name="square-outline" size={18} color={theme.colors.muted} />
                )}
              </View>
              <Text style={[styles.checkboxLabel, { color: theme.colors.text }]}>
                Okudum, kabul ediyorum.
              </Text>
            </Pressable>

            <Pressable
              onPress={() => router.push('/terms')}
              accessibilityRole="link"
              style={styles.linkRow}
            >
              <Text style={[styles.link, { color: theme.colors.primary }]}>
                Kullanım şartlarını oku
              </Text>
            </Pressable>
          </View>
        ) : null}

        {step === 2 ? (
          <View style={styles.block}>
            <Text style={[styles.heading, { color: theme.colors.text }]}>
              Seni nasıl çağırayım?
            </Text>
            <Text style={[styles.sub, { color: theme.colors.muted }]}>
              Takma ad isteğe bağlı. Doğum yılı zorunlu.
            </Text>

            <TextInput
              value={nickname}
              onChangeText={(text) => setNickname(text.slice(0, 40))}
              placeholder="Nasıl hitap edeyim?"
              placeholderTextColor={theme.colors.muted}
              maxLength={40}
              returnKeyType="done"
              style={[inputStyle(theme), { marginTop: theme.spacing.xl }]}
            />

            <Text
              style={[
                styles.fieldLabel,
                { color: theme.colors.muted, marginTop: theme.spacing.xl },
              ]}
            >
              Doğum yılı
            </Text>
            <View
              style={[
                styles.pickerBox,
                { borderColor: theme.colors.border, backgroundColor: theme.colors.surface },
              ]}
            >
              <Picker
                selectedValue={birthYear ?? undefined}
                onValueChange={(value) => setBirthYear(Number(value))}
                prompt="Doğum yılını seç"
                dropdownIconColor={theme.colors.muted}
                style={{ color: theme.colors.text }}
              >
                {years.map((year) => (
                  <Picker.Item key={year} label={String(year)} value={year} />
                ))}
              </Picker>
            </View>
          </View>
        ) : null}

        {step === 3 ? (
          <View style={styles.block}>
            <Text style={[styles.heading, { color: theme.colors.text }]}>
              Her akşam sana &apos;nasılsın?&apos; diye soralım mı?
            </Text>
            <Text style={[styles.sub, { color: theme.colors.muted }]}>
              İstersen kapatabilirsin; bu seni rahatsız etmesin diye var.
            </Text>

            <View style={[styles.switchRow, { marginTop: theme.spacing.xl }]}>
              <Text style={[styles.switchLabel, { color: theme.colors.text }]}>
                Akşam hatırlatması
              </Text>
              <Switch
                value={dailyCheckin}
                onValueChange={setDailyCheckin}
                accessibilityRole="switch"
                accessibilityState={{ checked: dailyCheckin }}
                trackColor={{ true: theme.colors.primary, false: theme.colors.border }}
                thumbColor={theme.colors.surface}
              />
            </View>
          </View>
        ) : null}
      </ScrollView>

      <View
        style={[
          styles.footer,
          {
            paddingBottom: insets.bottom + theme.spacing.lg,
            backgroundColor: theme.colors.bg,
            borderTopColor: theme.colors.border,
          },
        ]}
      >
        <PrimaryButton
          theme={theme}
          label={isLastStep ? 'Bitir' : 'Devam et'}
          onPress={continueFlow}
          busy={saving}
          disabled={!requirementMet}
        />
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: 24,
  },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  progressSegment: {
    flex: 1,
    height: 4,
    borderRadius: 2,
    marginRight: 6,
  },
  progressLabel: {
    fontSize: 12,
    marginLeft: 6,
  },
  block: {
    flex: 1,
    paddingTop: 32,
  },
  heading: {
    fontSize: 24,
    lineHeight: 32,
    fontWeight: '700',
  },
  sub: {
    fontSize: 15,
    lineHeight: 22,
    marginTop: 12,
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 24,
  },
  checkboxBox: {
    width: 26,
    height: 26,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxLabel: {
    fontSize: 15,
    lineHeight: 22,
    marginLeft: 12,
    flex: 1,
  },
  linkRow: {
    marginTop: 16,
  },
  link: {
    fontSize: 14,
    textDecorationLine: 'underline',
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  pickerBox: {
    borderWidth: 1,
    borderRadius: 18,
    overflow: 'hidden',
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  switchLabel: {
    fontSize: 15,
    lineHeight: 22,
    flex: 1,
  },
  footer: {
    paddingHorizontal: 24,
    paddingTop: 12,
    borderTopWidth: 1,
  },
});
