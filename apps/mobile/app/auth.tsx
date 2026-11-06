import { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase, PHONE_AUTH_ENABLED } from '../lib/supabase';
import { useTheme } from '../components/ThemeProvider';
import { inputStyle, PrimaryButton } from '../components/ui';

type Mode = 'signIn' | 'signUp';

export default function AuthScreen() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const [mode, setMode] = useState<Mode>('signIn');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (busy) return;
    if (!email.includes('@') || password.length < 6) {
      Alert.alert('Eksik bilgi', 'Geçerli bir e-posta ve en az 6 karakterli bir şifre yaz.');
      return;
    }

    setBusy(true);
    const result =
      mode === 'signIn'
        ? await supabase.auth.signInWithPassword({ email: email.trim(), password })
        : await supabase.auth.signUp({ email: email.trim(), password });

    setBusy(false);

    if (result.error) {
      Alert.alert('Giriş yapılamadı', result.error.message);
      return;
    }
    if (mode === 'signUp' && !result.data.session) {
      Alert.alert('Hesabın oluşturuldu', 'Şimdi giriş yapabilirsin.');
      setMode('signIn');
      return;
    }
    router.replace('/onboarding');
  }

  async function sendPhoneCode() {
    if (phone.replace(/\D/g, '').length < 10) {
      Alert.alert('Telefon numarası eksik', 'Geçerli bir telefon numarası yaz.');
      return;
    }
    setBusy(true);
    const { error } = await supabase.auth.signInWithOtp({
      phone: phone.startsWith('+') ? phone : `+90${phone.replace(/\D/g, '')}`,
    });
    setBusy(false);
    if (error) {
      Alert.alert('Kod gönderilemedi', error.message);
      return;
    }
    Alert.alert('Kod gönderildi', 'Telefonuna gelen kodu girebilirsin.');
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: theme.colors.bg }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={[
          styles.container,
          { paddingTop: insets.top + 48, paddingBottom: insets.bottom + 32 },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={[styles.brand, { color: theme.colors.primary }]}>DEVA</Text>
        <Text style={[styles.tagline, { color: theme.colors.text }]}>
          Burada seni dinlemek için var.
        </Text>
        <Text style={[styles.sub, { color: theme.colors.muted }]}>
          DEVA tanı koymaz, tedavi yerine geçmez.
        </Text>

        <View style={styles.form}>
          <TextInput
            value={email}
            onChangeText={setEmail}
            placeholder="E-posta"
            placeholderTextColor={theme.colors.muted}
            autoCapitalize="none"
            keyboardType="email-address"
            autoComplete="email"
            style={[inputStyle(theme), { marginBottom: theme.spacing.md }]}
          />
          <TextInput
            value={password}
            onChangeText={setPassword}
            placeholder="Şifre"
            placeholderTextColor={theme.colors.muted}
            secureTextEntry
            autoComplete={mode === 'signIn' ? 'current-password' : 'new-password'}
            style={inputStyle(theme)}
          />

          <View style={{ marginTop: theme.spacing.xl }}>
            <PrimaryButton
              theme={theme}
              label={mode === 'signIn' ? 'Giriş yap' : 'Hesap oluştur'}
              onPress={submit}
              busy={busy}
            />
          </View>

          <Pressable onPress={() => setMode(mode === 'signIn' ? 'signUp' : 'signIn')}>
            <Text style={[styles.switch, { color: theme.colors.muted }]}>
              {mode === 'signIn'
                ? 'Hesabın yok mu? Hesap oluştur'
                : 'Zaten hesabın var mı? Giriş yap'}
            </Text>
          </Pressable>

          {PHONE_AUTH_ENABLED ? (
            <View style={[styles.phoneBlock, { marginTop: theme.spacing.xl }]}>
              <TextInput
                value={phone}
                onChangeText={setPhone}
                placeholder="Telefon numarası"
                placeholderTextColor={theme.colors.muted}
                keyboardType="phone-pad"
                style={inputStyle(theme)}
              />
              <Pressable
                onPress={sendPhoneCode}
                style={[styles.secondary, { borderColor: theme.colors.border }]}
              >
                <Text style={{ color: theme.colors.primary }}>Kod gönder</Text>
              </Pressable>
            </View>
          ) : null}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    paddingHorizontal: 24,
  },
  brand: {
    fontSize: 32,
    fontWeight: '700',
    letterSpacing: 2,
  },
  tagline: {
    fontSize: 22,
    fontWeight: '600',
    marginTop: 16,
  },
  sub: {
    fontSize: 15,
    marginTop: 8,
  },
  form: {
    marginTop: 40,
  },
  switch: {
    textAlign: 'center',
    marginTop: 16,
    fontSize: 14,
  },
  phoneBlock: {
    gap: 12,
  },
  secondary: {
    height: 48,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
