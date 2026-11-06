import { useCallback, useEffect, useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { findInstrument, type Instrument } from '@shared/instruments';
import { needsSupportCard } from '@shared/scoring';
import { useTheme } from '../../components/ThemeProvider';
import { Card, PrimaryButton } from '../../components/ui';
import { callFunction } from '../../lib/api';
import { useScreeningResults } from '../../lib/supabase-hooks';

interface ScreeningResponse {
  completed: boolean;
  needsSupportCard: boolean;
}

interface Option {
  label: string;
  value: number;
}

const FREQ_OPTIONS: Option[] = [
  { label: 'Hiç değil', value: 0 },
  { label: 'Birkaç gün', value: 1 },
  { label: 'Yarıdan fazla gün', value: 2 },
  { label: 'Hemen hemen her gün', value: 3 },
];

const YESNO_OPTIONS: Option[] = [
  { label: 'Evet', value: 1 },
  { label: 'Hayır', value: 0 },
];

/**
 * Sonuç ekranında yalnızca iki sabit cümle görünür. Skor, bant ya da şiddet
 * kelimesi bu dosyanın hiçbir yerinde üretilmez, yazdırılmaz veya loglanmaz.
 */
const RESULT_TITLE = 'Anket tamamlandı.';
const RESULT_BODY = 'DEVA bunu sakladı.';
const SUPPORT_TEXT = 'Bu soruyu işaretlemen önemli. İstersen konuşabiliriz.';

export default function ScreeningCodeScreen() {
  // `code` çalışma anında hiç gelmeyebilir; `findInstrument` undefined döndüğü için
  // ekran geri döner.
  const params = useLocalSearchParams<{ code: string | string[] }>();
  const raw = params.code;
  const code = Array.isArray(raw) ? raw[0] : raw;
  const instrument = code ? findInstrument(code) : undefined;

  useEffect(() => {
    if (!instrument) router.back();
  }, [instrument]);

  if (!instrument) return null;

  return <ScreeningRunner instrument={instrument} />;
}

function ScreeningRunner({ instrument }: { instrument: Instrument }) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const { refresh } = useScreeningResults();

  const total = instrument.items.length;
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<(number | null)[]>(() => new Array<number | null>(total).fill(null));
  const [submitting, setSubmitting] = useState(false);
  const [failed, setFailed] = useState(false);
  const [finished, setFinished] = useState(false);
  const [showSupport, setShowSupport] = useState(false);

  const isLast = index === total - 1;
  const options = instrument.scale === 'freq0_3' ? FREQ_OPTIONS : YESNO_OPTIONS;
  const current = answers[index] ?? null;

  // `DimensionValue` yüzdeyi `${number}%` olarak tanımlar; türü burada açıkça
  // belirtiyoruz ki style bağlamından çıkarım yapılmasın.
  const progressWidth: `${number}%` = `${Math.round(((index + 1) / total) * 100)}%`;

  const select = useCallback(
    (value: number) => {
      setAnswers((prev) => {
        const next = prev.slice();
        next[index] = value;
        return next;
      });
      setFailed(false);
      if (index < total - 1) setIndex(index + 1);
    },
    [index, total],
  );

  const submit = useCallback(async () => {
    // Eksik cevap varsa gönderilmez; ölçek doğrulaması sunucuda da yapılır.
    if (answers.some((value) => value === null)) return;
    const filled = answers.map((value) => value ?? 0);
    setSubmitting(true);
    setFailed(false);
    try {
      const result = await callFunction<ScreeningResponse>('screening', {
        instrumentCode: instrument.code,
        answers: filled,
      });
      if (!result?.completed) {
        setFailed(true);
        return;
      }
      setShowSupport(needsSupportCard(instrument, filled));
      setFinished(true);
      void refresh();
    } catch {
      setFailed(true);
    } finally {
      setSubmitting(false);
    }
  }, [answers, instrument, refresh]);

  const goBack = useCallback(() => {
    if (index > 0) {
      setIndex(index - 1);
      return;
    }
    router.back();
  }, [index]);

  if (finished) {
    return (
      <ScrollView
        style={{ backgroundColor: theme.colors.bg }}
        contentContainerStyle={[
          styles.resultContent,
          { paddingTop: insets.top + 48, paddingBottom: insets.bottom + 32 },
        ]}
      >
        <Text style={[styles.resultTitle, { color: theme.colors.text }]}>{RESULT_TITLE}</Text>
        <Text style={[styles.resultBody, { color: theme.colors.muted }]}>{RESULT_BODY}</Text>

        {showSupport ? (
          <Card theme={theme} style={{ marginTop: theme.spacing.xl, width: '100%' }}>
            <Text style={[styles.supportText, { color: theme.colors.text }]}>{SUPPORT_TEXT}</Text>
            <View style={{ marginTop: theme.spacing.lg, gap: theme.spacing.md }}>
              <PrimaryButton
                theme={theme}
                label="DEVA ile konuş"
                onPress={() => router.replace('/(tabs)')}
              />
              <PrimaryButton
                theme={theme}
                label="Kriz ekranı"
                variant="secondary"
                onPress={() => router.push('/crisis')}
              />
            </View>
          </Card>
        ) : null}

        <View style={{ marginTop: theme.spacing.xl, width: '100%' }}>
          <PrimaryButton theme={theme} label="Kapat" variant="secondary" onPress={() => router.back()} />
        </View>
      </ScrollView>
    );
  }

  return (
    <ScrollView
      style={{ backgroundColor: theme.colors.bg }}
      contentContainerStyle={[
        styles.content,
        { paddingTop: insets.top + theme.spacing.sm, paddingBottom: insets.bottom + 32 },
      ]}
    >
      <View style={styles.header}>
        <Pressable
          onPress={goBack}
          accessibilityRole="button"
          accessibilityLabel="Geri"
          hitSlop={10}
          style={({ pressed }) => [styles.backButton, { opacity: pressed ? 0.6 : 1 }]}
        >
          <Ionicons name="chevron-back" size={24} color={theme.colors.text} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: theme.colors.text }]}>{instrument.title}</Text>
        <Text style={[styles.progress, { color: theme.colors.muted }]}>
          {`${index + 1} / ${total}`}
        </Text>
      </View>

      <View style={[styles.progressTrack, { backgroundColor: theme.colors.surfaceAlt }]}>
        <View
          style={[
            styles.progressFill,
            {
              backgroundColor: theme.colors.primary,
              width: progressWidth,
            },
          ]}
        />
      </View>

      {index === 0 ? (
        <Text style={[styles.intro, { color: theme.colors.muted }]}>{instrument.intro}</Text>
      ) : null}

      <Card theme={theme} style={{ marginTop: theme.spacing.md }}>
        <Text style={[styles.question, { color: theme.colors.text }]}>
          {instrument.items[index]?.text ?? ''}
        </Text>
      </Card>

      <View style={{ marginTop: theme.spacing.xl, gap: theme.spacing.md }}>
        {options.map((option) => {
          const selected = current === option.value;
          return (
            <Pressable
              key={option.label}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              onPress={() => select(option.value)}
              style={({ pressed }) => [
                styles.option,
                {
                  borderRadius: theme.radius,
                  borderWidth: 1,
                  borderColor: selected ? theme.colors.primary : theme.colors.border,
                  backgroundColor: selected ? theme.colors.primarySoft : theme.colors.surface,
                  opacity: pressed ? 0.7 : 1,
                },
              ]}
            >
              <Text style={[styles.optionLabel, { color: theme.colors.text }]}>{option.label}</Text>
            </Pressable>
          );
        })}
      </View>

      {failed ? (
        <Text style={[styles.error, { color: theme.colors.danger }]}>
          Anket gönderilemedi. Bağlantını kontrol edip tekrar deneyebilirsin.
        </Text>
      ) : null}

      {isLast ? (
        <View style={{ marginTop: theme.spacing.xl }}>
          <PrimaryButton
            theme={theme}
            label="Tamamla"
            onPress={submit}
            busy={submitting}
            disabled={current === null}
          />
        </View>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: 16,
    flexGrow: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  backButton: {
    paddingRight: 8,
  },
  headerTitle: {
    flex: 1,
    fontSize: 17,
    fontWeight: '600',
  },
  progress: {
    fontSize: 12,
  },
  progressTrack: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: 6,
    borderRadius: 3,
  },
  intro: {
    fontSize: 15,
    lineHeight: 22,
    marginTop: 16,
  },
  question: {
    fontSize: 17,
    lineHeight: 26,
  },
  option: {
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  optionLabel: {
    fontSize: 15,
  },
  error: {
    fontSize: 15,
    lineHeight: 22,
    marginTop: 16,
  },
  resultContent: {
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  resultTitle: {
    fontSize: 17,
    fontWeight: '600',
    textAlign: 'center',
  },
  resultBody: {
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
    marginTop: 8,
  },
  supportText: {
    fontSize: 15,
    lineHeight: 22,
  },
});
