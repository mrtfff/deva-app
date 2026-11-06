import { useRef, useState } from 'react';
import {
  Animated,
  FlatList,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../components/ThemeProvider';
import { EmptyState, PrimaryButton } from '../../components/ui';
import { useConversations } from '../../lib/supabase-hooks';
import type { Theme } from '../../lib/theme';
import { daysAgoLabel } from '@shared/dates';

const EMPTY_TEXT = 'Henüz sohbet yok. Ne düşündüğünü anlatmak istersen buradayım.';
const PREVIEW_LENGTH = 40;
const ACTION_WIDTH = 88;
const OPEN_THRESHOLD = 44;

interface ConversationRowProps {
  theme: Theme;
  title: string;
  lastMessageAt: string;
  onOpen: () => void;
  onDelete: () => void;
}

function ConversationRow({ theme, title, lastMessageAt, onOpen, onDelete }: ConversationRowProps) {
  const translateX = useRef(new Animated.Value(0)).current;
  const openRef = useRef(false);

  const settle = (open: boolean) => {
    openRef.current = open;
    Animated.spring(translateX, {
      toValue: open ? ACTION_WIDTH : 0,
      useNativeDriver: true,
      bounciness: 0,
    }).start();
  };

  const panResponder = useRef(
    PanResponder.create({
      // Yatay sola hâlâ listenin dikey kaydırmasına dokunulabilsin.
      onMoveShouldSetPanResponder: (_event, gesture) =>
        gesture.dx > 8 && Math.abs(gesture.dx) > Math.abs(gesture.dy),
      onPanResponderMove: (_event, gesture) => {
        const base = openRef.current ? ACTION_WIDTH : 0;
        translateX.setValue(Math.max(0, Math.min(base + gesture.dx, ACTION_WIDTH)));
      },
      onPanResponderRelease: (_event, gesture) => {
        const base = openRef.current ? ACTION_WIDTH : 0;
        settle(base + gesture.dx > OPEN_THRESHOLD);
      },
      onPanResponderTerminate: () => settle(openRef.current),
    }),
  ).current;

  return (
    <View style={styles.clip}>
      <View style={[styles.deleteLayer, { backgroundColor: theme.colors.danger }]}>
        <Pressable
          onPress={() => {
            settle(false);
            onDelete();
          }}
          accessibilityRole="button"
          accessibilityLabel="Sil"
          style={styles.deleteButton}
        >
          <Text style={[styles.deleteLabel, { color: theme.colors.surface }]}>Sil</Text>
        </Pressable>
      </View>

      <Animated.View
        {...panResponder.panHandlers}
        style={[{ transform: [{ translateX }], backgroundColor: theme.colors.bg }]}
      >
        <Pressable
          onPress={() => {
            if (openRef.current) {
              settle(false);
              return;
            }
            onOpen();
          }}
          accessibilityRole="button"
          style={[
            styles.row,
            {
              borderBottomColor: theme.colors.border,
              paddingHorizontal: theme.spacing.lg,
              paddingVertical: theme.spacing.md,
            },
          ]}
        >
          <View style={styles.rowText}>
            <Text
              numberOfLines={1}
              style={{ color: theme.colors.text, fontSize: theme.type.body, fontWeight: '600' }}
            >
              {title.slice(0, PREVIEW_LENGTH)}
            </Text>
            <Text style={{ color: theme.colors.muted, fontSize: theme.type.caption }}>
              {daysAgoLabel(lastMessageAt)}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={theme.colors.muted} />
        </Pressable>
      </Animated.View>
    </View>
  );
}

export default function ChatHistoryScreen() {
  const { theme } = useTheme();
  const { conversations, loading, refresh, remove } = useConversations();
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await refresh();
    } finally {
      setRefreshing(false);
    }
  };

  if (conversations.length === 0 && !loading) {
    return (
      <View style={[styles.container, styles.emptyWrap, { backgroundColor: theme.colors.bg }]}>
        <EmptyState theme={theme} title={EMPTY_TEXT} />
        <View style={styles.emptyAction}>
          <PrimaryButton
            theme={theme}
            label="Sohbete dön"
            onPress={() => router.replace('/(tabs)')}
          />
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.bg }]}>
      <FlatList
        data={conversations}
        keyExtractor={(item) => item.id}
        refreshing={refreshing}
        onRefresh={() => void onRefresh()}
        renderItem={({ item }) => (
          <ConversationRow
            theme={theme}
            title={item.title ?? 'Sohbet'}
            lastMessageAt={item.last_message_at}
            onOpen={() => router.push({ pathname: '/chat/[id]', params: { id: item.id } })}
            onDelete={() => {
              void remove(item.id);
            }}
          />
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  clip: {
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  rowText: {
    flex: 1,
    gap: 4,
  },
  deleteLayer: {
    ...StyleSheet.absoluteFill,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  deleteButton: {
    width: ACTION_WIDTH,
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteLabel: {
    fontSize: 15,
    fontWeight: '600',
  },
  emptyWrap: {
    justifyContent: 'center',
  },
  emptyAction: {
    paddingHorizontal: 24,
  },
});