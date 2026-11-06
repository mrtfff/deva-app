import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { INSTRUMENTS } from '@shared/instruments';
import { useTheme } from '../../components/ThemeProvider';
import { Card, SectionTitle } from '../../components/ui';

/**
 * Anketler hiçbir zaman otomatik çalışmaz; yalnızca kullanıcı bir ölçeği
 * kendisi seçtiğinde başlar.
 */
const INFO_TEXT =
  "Bu anketler DEVA'nın sana daha uygun bir uzman önermesine yardımcı olur. Sonuçlarını sana göstermeyiz.";
const OPTIONAL_TEXT = 'İstersen çalıştır, istemezsen geç.';

export default function ScreeningListScreen() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <ScrollView
      style={{ backgroundColor: theme.colors.bg }}
      contentContainerStyle={[
        styles.content,
        { paddingBottom: insets.bottom + theme.spacing.xl },
      ]}
    >
      <SectionTitle theme={theme}>Anketler</SectionTitle>

      {INSTRUMENTS.map((instrument) => (
        <Pressable
          key={instrument.code}
          accessibilityRole="button"
          accessibilityLabel={`${instrument.title} anketini çalıştır`}
          onPress={() => router.push(`/screening/${instrument.code}`)}
          style={({ pressed }) => [styles.cardPressable, { opacity: pressed ? 0.7 : 1 }]}
        >
          <Card theme={theme}>
            <View style={styles.row}>
              <View style={styles.rowText}>
                <Text style={[styles.title, { color: theme.colors.text }]}>
                  {instrument.title}
                </Text>
                <Text style={[styles.subtitle, { color: theme.colors.muted }]}>
                  {instrument.intro}
                </Text>
              </View>
              <View style={styles.meta}>
                <Text style={[styles.count, { color: theme.colors.primary }]}>
                  {`${instrument.items.length} soru`}
                </Text>
                <Ionicons name="chevron-forward" size={18} color={theme.colors.muted} />
              </View>
            </View>
          </Card>
        </Pressable>
      ))}

      <Text style={[styles.info, { color: theme.colors.text }]}>{INFO_TEXT}</Text>
      <Text style={[styles.optional, { color: theme.colors.muted }]}>{OPTIONAL_TEXT}</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: 16,
    paddingTop: 24,
  },
  cardPressable: {
    marginBottom: 12,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  rowText: {
    flex: 1,
    paddingRight: 12,
  },
  meta: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  count: {
    fontSize: 15,
    fontWeight: '600',
    marginRight: 4,
  },
  title: {
    fontSize: 17,
    fontWeight: '600',
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 22,
    marginTop: 4,
  },
  info: {
    fontSize: 15,
    lineHeight: 22,
    marginTop: 16,
  },
  optional: {
    fontSize: 12,
    marginTop: 8,
  },
});
