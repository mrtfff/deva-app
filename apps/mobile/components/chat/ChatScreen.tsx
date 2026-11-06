import { useEffect, useRef, useState } from 'react';
import {
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTheme } from '../ThemeProvider';
import { Chip, inputStyle, PrimaryButton } from '../ui';
import { CrisisCard } from '../facility/CrisisCard';
import { TERMINAL_DISCLAIMER } from '../../lib/legal';
import { streamChat } from '../../lib/stream';
import { findMatchingNote, parseMemoryCommand } from '../../lib/commands';
import { useConversations, useMemoryNotes, useMessages, useStreak } from '../../lib/supabase-hooks';
import { CRISIS_WARN_TEXT } from '@shared/crisis';
import { daysAgoLabel } from '@shared/dates';

/** Sohbet boşken tek dokunuşla gönderilebilen başlangıç cümleleri. */
const QUICK_START = [
  'İyi hissediyorum',
  'Kararsızım',
  'Çok kötüyüm',
  'Yalnız hissediyorum',
  'Uykusuzum',
  'Kızgınım',
] as const;

const QUOTA_BANNER_TEXT =
  'Bugünlük sınırı doldu — DEVA biraz daha kısa cevap veriyor ama dinlemeye devam ediyor.';

const IDLE_LINE = 'Dinliyorum, hazır olduğunda yazabilirsin.';
const CELEBRATE_LINE = 'Bugün de buradaydın, güzel.';
const NOTE_LINE = 'Not aldım.';
const NOT_FORGOTTEN_TITLE = 'Bunu hatırlamıyorum.';
const NOT_FORGOTTEN_BODY = 'Bu ifadeye uyan bir not yok.';

interface ChatItem {
  key: string;
  role: 'user' | 'assistant';
  content: string;
  streaming?: boolean;
}

interface SendOptions {
  /** Kullanıcı balonu yerine eklenmesin mi? "Devam et" akışında false. */
  echoUser?: boolean;
  skipCrisisCheck?: boolean;
}

interface RetryState extends SendOptions {
  content: string;
}

export function ChatScreen({
  conversationId: initialConversationId,
  onOpenHistory,
}: {
  conversationId?: string;
  onOpenHistory?: () => void;
}) {
  const { theme } = useTheme();
  const router = useRouter();

  const [conversationId, setConversationId] = useState<string | undefined>(initialConversationId);
  const [items, setItems] = useState<ChatItem[]>([]);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [quickStartVisible, setQuickStartVisible] = useState(true);

  const [quotaDegraded, setQuotaDegraded] = useState(false);
  const [quotaDismissed, setQuotaDismissed] = useState(false);

  /** 'choice' → "Devam et" / "Kriz ekranını aç", 'persistent' → kalıcı yardım kartı. */
  const [crisisCard, setCrisisCard] = useState<'none' | 'choice' | 'persistent'>('none');
  const [pendingCrisisContent, setPendingCrisisContent] = useState<string>('');

  const [statusLine, setStatusLine] = useState<string | null>(null);
  const [celebrate, setCelebrate] = useState(false);
  const [retry, setRetry] = useState<RetryState | null>(null);

  const inputRef = useRef<React.ComponentRef<typeof TextInput>>(null);
  const abortRef = useRef<AbortController | null>(null);
  const keyRef = useRef(0);
  /** Bu sohbete istemci tarafında dokunuldu mu? Sunucu boş dönse de yerel liste korunur. */
  const ownedKeyRef = useRef<string | null>(null);

  const { messages, loading: messagesLoading } = useMessages(conversationId ?? null);
  const { conversations, refresh: refreshConversations, create } = useConversations();
  const { streak, refresh: refreshStreak } = useStreak();
  const { notes, add: addNote, remove: removeNote } = useMemoryNotes();

  // Sunucudan gelen mesajlar yalnızca konuşma henüz yerel olarak
  // sahiplenilmediyse listeye yazılır; aksi halde akış sırasında gelen
  // boş yanıt yerel mesajları silmezdi.
  useEffect(() => {
    if (messagesLoading) return;
    const key = conversationId ?? null;
    if (ownedKeyRef.current === key) return;
    ownedKeyRef.current = key;
    setItems(
      messages.map((message) => ({
        key: message.id,
        role: message.role,
        content: message.content,
      })),
    );
  }, [conversationId, messages, messagesLoading]);

  useEffect(
    () => () => {
      abortRef.current?.abort();
    },
    [],
  );

  const nextKey = () => {
    keyRef.current += 1;
    return `local-${keyRef.current}`;
  };

  const appendUser = (content: string) => {
    setItems((current) => [...current, { key: nextKey(), role: 'user', content }]);
  };

  const appendAssistant = () => {
    const key = nextKey();
    setItems((current) => [...current, { key, role: 'assistant', content: '', streaming: true }]);
    return key;
  };

  const patchAssistant = (key: string, patch: Partial<ChatItem>) => {
    setItems((current) =>
      current.map((item) => (item.key === key ? { ...item, ...patch } : item)),
    );
  };

  const appendDelta = (key: string, text: string) => {
    setItems((current) =>
      current.map((item) => (item.key === key ? { ...item, content: item.content + text } : item)),
    );
  };

  const openHistory = () => {
    if (onOpenHistory) {
      onOpenHistory();
      return;
    }
    router.push('/chat/history');
  };

  const openCrisisScreen = () => {
    router.push('/crisis');
  };

  const errorText = (code: string) => {
    switch (code) {
      case 'unauthorized':
        return 'Oturumunun süresi dolmuş görünüyor. Yeniden giriş yaptıktan sonra tekrar deneyebilirsin.';
      case 'invalid_request':
        return 'Bu mesaj gönderilemedi. Yazımını gözden geçirip tekrar deneyebilirsin.';
      case 'network_error':
        return 'Bağlantı kurulamadı. İnternetin açık olduğundan emin olup tekrar deneyebilirsin.';
      default:
        return 'Bir şeyler ters gitti. Birazdan tekrar deneyebilirsin.';
    }
  };

  async function runStream(content: string, options: SendOptions) {
    let targetConversationId = conversationId;

    if (!targetConversationId) {
      const created = await create();
      if (!created) {
        setRetry({ content, ...options });
        setStatusLine(null);
        return;
      }
      targetConversationId = created;
      ownedKeyRef.current = created;
      setConversationId(created);
    }

    if (options.echoUser !== false) appendUser(content);

    const assistantKey = appendAssistant();
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      await streamChat(
        {
          conversationId: targetConversationId,
          content,
          skipCrisisCheck: options.skipCrisisCheck,
        },
        (event) => {
          switch (event.type) {
            case 'delta':
              appendDelta(assistantKey, event.text);
              break;
            case 'crisis':
              patchAssistant(assistantKey, { content: CRISIS_WARN_TEXT, streaming: false });
              setPendingCrisisContent(content);
              setCrisisCard('choice');
              break;
            case 'quota':
              setQuotaDegraded(event.degraded);
              break;
            case 'memory':
              // Notlar yalnızca Profil ekranında görünür; burada sessiz kalır.
              break;
            case 'done':
              patchAssistant(assistantKey, { streaming: false });
              setQuotaDegraded(event.quota.degraded);
              if (event.celebrate) setCelebrate(true);
              void refreshConversations();
              void refreshStreak();
              break;
            case 'error':
              patchAssistant(assistantKey, { streaming: false });
              setItems((current) => current.filter((item) => item.key !== assistantKey || item.content));
              setRetry({ content, ...options });
              setStatusLine(errorText(event.code));
              break;
          }
        },
        controller.signal,
      );
    } catch (error) {
      patchAssistant(assistantKey, { streaming: false });
      setItems((current) => current.filter((item) => item.key !== assistantKey || item.content));
      const code = error instanceof Error ? error.message : '';
      setRetry({ content, ...options });
      setStatusLine(errorText(code));
    }
  }

  async function send(raw: string, options: SendOptions = {}) {
    const content = raw.trim();
    if (!content || busy) return;

    setStatusLine(null);
    setRetry(null);
    setCelebrate(false);
    setBusy(true);

    try {
      const command = parseMemoryCommand(content);

      if (command?.kind === 'note') {
        await addNote(command.content, 'fact');
        setStatusLine(NOTE_LINE);
        return;
      }

      if (command?.kind === 'forget') {
        const match = findMatchingNote(notes, command.content);
        if (!match) {
          Alert.alert(NOT_FORGOTTEN_TITLE, NOT_FORGOTTEN_BODY);
          return;
        }
        Alert.alert('Bu notu sil', `"${match.content}" notunu silmek ister misin?`, [
          { text: 'Vazgeç', style: 'cancel' },
          {
            text: 'Sil',
            style: 'destructive',
            onPress: () => {
              void removeNote(match.id);
            },
          },
        ]);
        return;
      }

      await runStream(content, options);
    } finally {
      setBusy(false);
    }
  }

  function handleSubmit() {
    const content = text.trim();
    if (!content) return;
    setText('');
    void send(content);
  }

  function handleQuickStart(label: string) {
    void send(label);
  }

  function handleNotWantingToTalk() {
    setQuickStartVisible(false);
    setItems((current) => [
      ...current,
      { key: nextKey(), role: 'assistant', content: IDLE_LINE },
    ]);
    inputRef.current?.focus();
  }

  function handleContinueAfterCrisis() {
    const content = pendingCrisisContent;
    setCrisisCard('persistent');
    if (!content) return;
    void send(content, { skipCrisisCheck: true, echoUser: false });
  }

  const conversation = conversations.find((item) => item.id === conversationId);
  const lastMessageAt =
    conversation?.last_message_at ??
    (conversationId ? null : (conversations[0]?.last_message_at ?? null));

  const chatEmpty = items.length === 0;
  const showQuickStart = chatEmpty && quickStartVisible;
  const showQuotaBanner = quotaDegraded && !quotaDismissed;

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: theme.colors.bg }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 88 : 0}
    >
      <View
        style={[
          styles.headerRow,
          {
            borderBottomColor: theme.colors.border,
            paddingHorizontal: theme.spacing.lg,
            paddingTop: theme.spacing.md,
            paddingBottom: theme.spacing.md,
          },
        ]}
      >
        <View style={styles.headerInfo}>
          {lastMessageAt ? (
            <Text style={{ color: theme.colors.muted, fontSize: theme.type.caption }}>
              {`Son konuşman: ${daysAgoLabel(lastMessageAt)}`}
            </Text>
          ) : null}
          {streak && streak.current_streak > 0 ? (
            <View
              style={[
                styles.streakChip,
                {
                  backgroundColor: theme.colors.primarySoft,
                  borderRadius: theme.radius,
                  marginTop: theme.spacing.xs,
                },
              ]}
            >
              <Text style={{ color: theme.colors.primary, fontSize: theme.type.caption }}>
                {`Serin: ${streak.current_streak} gün`}
              </Text>
            </View>
          ) : null}
        </View>

        <Pressable
          onPress={openHistory}
          accessibilityRole="button"
          accessibilityLabel="Sohbet geçmişi"
          hitSlop={8}
          style={{ padding: theme.spacing.xs }}
        >
          <Ionicons name="time-outline" size={24} color={theme.colors.text} />
        </Pressable>
      </View>

      {showQuotaBanner ? (
        <View
          style={[
            styles.quotaBanner,
            {
              backgroundColor: theme.colors.surfaceAlt,
              marginHorizontal: theme.spacing.lg,
              borderRadius: theme.radius,
              paddingLeft: theme.spacing.md,
            },
          ]}
        >
          <Text
            style={[
              styles.quotaText,
              { color: theme.colors.muted, fontSize: theme.type.caption },
            ]}
          >
            {QUOTA_BANNER_TEXT}
          </Text>
          <Pressable
            onPress={() => setQuotaDismissed(true)}
            accessibilityRole="button"
            accessibilityLabel="Bildirimi kapat"
            hitSlop={8}
            style={{ padding: theme.spacing.sm }}
          >
            <Ionicons name="close" size={16} color={theme.colors.muted} />
          </Pressable>
        </View>
      ) : null}

      <FlatList
        inverted
        data={[...items].reverse()}
        keyExtractor={(item) => item.key}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{
          paddingHorizontal: theme.spacing.lg,
          paddingVertical: theme.spacing.md,
        }}
        renderItem={({ item }) => {
          const isUser = item.role === 'user';
          return (
            <View
              style={[
                styles.bubble,
                {
                  backgroundColor: isUser ? theme.colors.primarySoft : theme.colors.surface,
                  borderRadius: theme.radius,
                  padding: theme.spacing.md,
                  marginBottom: theme.spacing.sm,
                  alignSelf: isUser ? 'flex-end' : 'flex-start',
                  maxWidth: '85%',
                },
              ]}
            >
              {item.streaming && !item.content ? (
                <Text
                  style={{
                    color: theme.colors.muted,
                    fontSize: theme.type.caption,
                  }}
                >
                  yazıyor ···
                </Text>
              ) : (
                <Text
                  style={{
                    color: theme.colors.text,
                    fontSize: theme.type.body,
                    lineHeight: theme.type.bodyLineHeight,
                  }}
                >
                  {item.content}
                </Text>
              )}
            </View>
          );
        }}
      />

      <View
        style={[
          styles.bottom,
          {
            borderTopColor: theme.colors.border,
            paddingHorizontal: theme.spacing.lg,
            paddingTop: theme.spacing.md,
            paddingBottom: theme.spacing.md,
          },
        ]}
      >
        {showQuickStart ? (
          <>
            <View style={styles.quickStartRow}>
              {QUICK_START.map((label) => (
                <View key={label} style={{ marginBottom: theme.spacing.sm }}>
                  <Chip theme={theme} label={label} onPress={() => handleQuickStart(label)} />
                </View>
              ))}
            </View>
            <View style={[styles.quickStartActions, { marginBottom: theme.spacing.md }]}>
              <View style={styles.grow}>
                <PrimaryButton
                  theme={theme}
                  label="Ya da buradan yaz"
                  variant="secondary"
                  onPress={() => inputRef.current?.focus()}
                />
              </View>
              <View style={styles.grow}>
                <PrimaryButton
                  theme={theme}
                  label="Konuşmak istemiyorum"
                  variant="secondary"
                  onPress={handleNotWantingToTalk}
                />
              </View>
            </View>
          </>
        ) : null}

        {statusLine || celebrate ? (
          <Text
            style={[
              styles.noticeLine,
              { color: theme.colors.muted, fontSize: theme.type.caption },
            ]}
          >
            {statusLine ?? CELEBRATE_LINE}
          </Text>
        ) : null}

        {retry ? (
          <View style={{ marginBottom: theme.spacing.sm }}>
            <PrimaryButton
              theme={theme}
              label="Tekrar dene"
              variant="secondary"
              onPress={() => {
                void send(retry.content, {
                  echoUser: retry.echoUser,
                  skipCrisisCheck: retry.skipCrisisCheck,
                });
              }}
            />
          </View>
        ) : null}

        <View style={styles.inputRow}>
          <TextInput
            ref={inputRef}
            style={[inputStyle(theme), styles.input]}
            value={text}
            onChangeText={setText}
            placeholder="Ne düşündüğünü yaz…"
            placeholderTextColor={theme.colors.muted}
            multiline
            onSubmitEditing={handleSubmit}
            blurOnSubmit={false}
          />
          <Pressable
            onPress={handleSubmit}
            disabled={busy || text.trim().length === 0}
            accessibilityRole="button"
            accessibilityLabel="Gönder"
            style={[
              styles.sendButton,
              {
                backgroundColor: theme.colors.primary,
                borderRadius: theme.radius,
                opacity: busy || text.trim().length === 0 ? 0.5 : 1,
              },
            ]}
          >
            <Ionicons name="send" size={20} color={theme.colors.surface} />
          </Pressable>
        </View>

        {crisisCard !== 'none' ? (
          <View style={{ marginTop: theme.spacing.md }}>
            <CrisisCard
              theme={theme}
              onContinue={crisisCard === 'choice' ? handleContinueAfterCrisis : undefined}
              onOpenCrisis={openCrisisScreen}
            />
          </View>
        ) : null}

        <Text
          style={[
            styles.disclaimer,
            { color: theme.colors.muted, fontSize: theme.type.caption },
          ]}
        >
          {TERMINAL_DISCLAIMER}
        </Text>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerInfo: {
    flex: 1,
  },
  streakChip: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  quotaBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    paddingVertical: 8,
  },
  quotaText: {
    flex: 1,
    lineHeight: 17,
  },
  bubble: {
    justifyContent: 'center',
  },
  bottom: {
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  quickStartRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  quickStartActions: {
    flexDirection: 'row',
    gap: 8,
  },
  grow: {
    flex: 1,
  },
  noticeLine: {
    marginBottom: 8,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
  },
  input: {
    flex: 1,
    minHeight: 52,
    maxHeight: 132,
    paddingTop: 14,
  },
  sendButton: {
    width: 52,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disclaimer: {
    textAlign: 'center',
    marginTop: 12,
  },
});