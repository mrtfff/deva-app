import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../components/ThemeProvider';
import { Card, PrimaryButton } from '../components/ui';
import { KVKK_SECTIONS, TERMS_SECTIONS, TERMS_VERSION } from '../lib/legal';

export default function TermsScreen() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <ScrollView
      style={{ backgroundColor: theme.colors.bg }}
      contentContainerStyle={[
        styles.content,
        { paddingTop: theme.spacing.lg, paddingBottom: insets.bottom + theme.spacing.xl },
      ]}
    >
      <Text style={[styles.version, { color: theme.colors.muted }]}>
        Sürüm {TERMS_VERSION}
      </Text>

      <Text style={[styles.heading, { color: theme.colors.text }]}>Kullanım Şartları</Text>
      {TERMS_SECTIONS.map((section) => (
        <Card key={section.title} theme={theme} style={styles.card}>
          <Text style={[styles.title, { color: theme.colors.text }]}>{section.title}</Text>
          <Text style={[styles.body, { color: theme.colors.muted }]}>{section.body}</Text>
        </Card>
      ))}

      <Text style={[styles.heading, { color: theme.colors.text }]}>KVKK Aydınlatma Metni</Text>
      {KVKK_SECTIONS.map((section) => (
        <Card key={section.title} theme={theme} style={styles.card}>
          <Text style={[styles.title, { color: theme.colors.text }]}>{section.title}</Text>
          <Text style={[styles.body, { color: theme.colors.muted }]}>{section.body}</Text>
        </Card>
      ))}

      <View style={styles.footer}>
        <PrimaryButton theme={theme} label="Kabul ediyorum" onPress={() => router.back()} />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: 20,
  },
  version: {
    fontSize: 12,
  },
  heading: {
    fontSize: 22,
    lineHeight: 30,
    fontWeight: '700',
    marginTop: 24,
    marginBottom: 12,
  },
  card: {
    marginBottom: 12,
  },
  title: {
    fontSize: 17,
    lineHeight: 24,
    fontWeight: '600',
  },
  body: {
    fontSize: 15,
    lineHeight: 22,
    marginTop: 8,
  },
  footer: {
    marginTop: 16,
  },
});
