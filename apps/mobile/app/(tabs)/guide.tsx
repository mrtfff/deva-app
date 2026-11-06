import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ALTERNATIVE_FACILITY_TYPES, SPECIALIST_LABELS } from '@shared/triage';
import type { SpecialistType } from '@shared/types';
import { useTheme } from '../../components/ThemeProvider';
import { Chip, EmptyState, PrimaryButton, SectionTitle } from '../../components/ui';
import { callFunction } from '../../lib/api';
import { useConversations } from '../../lib/supabase-hooks';

interface TriageResponse {
  type: SpecialistType;
  reason: string;
}

const ALTERNATIVE_LABELS: Record<SpecialistType, string> = {
  psychiatrist: 'Psikiyatrist de olabilir',
  psychologist: 'Psikolog da olabilir',
  dietitian: 'Diyetisyen de olabilir',
};

const NEED_MORE_TALK = 'Yönlendirme için biraz konuşmamız gerekiyor';

export default function GuideScreen() {
  const { theme } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { conversations, loading: conversationsLoading } = useConversations();

  const conversationId = conversations[0]?.id;
  const [result, setResult] = useState<TriageResponse | null>(null);
  const [failed, setFailed] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setFailed(false);
    try {
      const response = await callFunction<TriageResponse>('triage', { conversationId });
      setResult(response?.type ? response : null);
    } catch {
      setResult(null);
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }, [conversationId]);

  useEffect(() => {
    if (conversationsLoading) return;
    void load();
  }, [conversationsLoading, load]);

  if (loading || conversationsLoading) {
    return (
      <View style={[styles.centered, { backgroundColor: theme.colors.bg }]}>
        <ActivityIndicator color={theme.colors.primary} />
      </View>
    );
  }

  if (failed || !result) {
    return (
      <ScrollView
        style={{ backgroundColor: theme.colors.bg }}
        contentContainerStyle={[
          styles.page,
          { padding: theme.spacing.xl, paddingBottom: insets.bottom + theme.spacing.xl },
        ]}
      >
        <EmptyState
          theme={theme}
          title={NEED_MORE_TALK}
          body="Anketlerden ve konuştuğumuz şeylerden bir yol haritası çıkarabilirim."
        />
        <View style={{ marginTop: theme.spacing.lg }}>
          <PrimaryButton theme={theme} label="Sohbete git" onPress={() => router.push('/(tabs)')} />
        </View>
      </ScrollView>
    );
  }

  const alternatives = ALTERNATIVE_FACILITY_TYPES[result.type];

  return (
    <ScrollView
      style={{ backgroundColor: theme.colors.bg }}
      contentContainerStyle={[
        styles.page,
        { padding: theme.spacing.xl, paddingBottom: insets.bottom + theme.spacing.xl },
      ]}
    >
      <Text style={[styles.heading, { color: theme.colors.text }]}>
        {SPECIALIST_LABELS[result.type]}
      </Text>

      <Text style={[styles.reason, { color: theme.colors.text }]}>{result.reason}</Text>

      <View style={{ marginTop: theme.spacing.xl }}>
        <PrimaryButton
          theme={theme}
          label="Yakınımdakileri göster"
          onPress={() => router.push('/facilities')}
        />
      </View>

      <Text style={[styles.note, { color: theme.colors.muted }]}>
        Sonuç sana göre; bir uzmana kararı sen verirsin.
      </Text>

      {alternatives.length > 0 ? (
        <View style={{ marginTop: theme.spacing.xl }}>
          <SectionTitle theme={theme}>Başka bir uzman da olabilir</SectionTitle>
          <View style={styles.chips}>
            {alternatives.map((alternative) => (
              <Chip
                key={alternative}
                theme={theme}
                label={ALTERNATIVE_LABELS[alternative]}
                onPress={() => router.push(`/facilities?type=${alternative}`)}
              />
            ))}
          </View>
        </View>
      ) : null}
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
  heading: {
    fontSize: 24,
    fontWeight: '700',
    lineHeight: 32,
  },
  reason: {
    marginTop: 16,
    fontSize: 15,
    lineHeight: 22,
  },
  note: {
    marginTop: 12,
    fontSize: 12,
    lineHeight: 18,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
});