import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../components/ThemeProvider';
import { Card, Chip, EmptyState, PrimaryButton, inputStyle } from '../components/ui';
import { useMemoryNotes, type MemoryNote } from '../lib/supabase-hooks';
import type { Theme } from '../lib/theme';

type NoteCategory = MemoryNote['category'];

const CATEGORY_ORDER: NoteCategory[] = ['fact', 'preference', 'event', 'context'];

const CATEGORY_LABELS: Record<NoteCategory, string> = {
  fact: 'Bilgi',
  preference: 'Tercih',
  event: 'Olay',
  context: 'Bağlam',
};

/** Not metni veritabanında 200 karakterle sınırlı. */
const MAX_LENGTH = 200;

function CategoryChips({
  theme,
  selected,
  onSelect,
}: {
  theme: Theme;
  selected: NoteCategory;
  onSelect: (category: NoteCategory) => void;
}) {
  return (
    <View style={styles.chipRow}>
      {CATEGORY_ORDER.map((category) => (
        <Chip
          key={category}
          theme={theme}
          label={CATEGORY_LABELS[category]}
          selected={category === selected}
          onPress={() => onSelect(category)}
        />
      ))}
    </View>
  );
}

export default function MemoryScreen() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const { notes, loading, add, update, remove, forgetAll } = useMemoryNotes();

  const [adding, setAdding] = useState(false);
  const [newContent, setNewContent] = useState('');
  const [newCategory, setNewCategory] = useState<NoteCategory>('fact');

  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftContent, setDraftContent] = useState('');
  const [draftCategory, setDraftCategory] = useState<NoteCategory>('fact');

  function startAdd() {
    setAdding(true);
    setEditingId(null);
  }

  function cancelAdd() {
    setAdding(false);
    setNewContent('');
    setNewCategory('fact');
  }

  async function saveNew() {
    const content = newContent.trim();
    if (content.length === 0) return;
    await add(content, newCategory);
    cancelAdd();
  }

  function startEdit(note: MemoryNote) {
    setAdding(false);
    setEditingId(note.id);
    setDraftContent(note.content);
    setDraftCategory(note.category);
  }

  function cancelEdit() {
    setEditingId(null);
    setDraftContent('');
    setDraftCategory('fact');
  }

  async function saveEdit(id: string) {
    const content = draftContent.trim();
    if (content.length === 0) return;
    await update(id, content, draftCategory);
    cancelEdit();
  }

  function confirmForgetAll() {
    Alert.alert(
      'Tümünü unut',
      'DEVA\'nın senden hatırladığı her şey kalıcı olarak silinecek.',
      [
        { text: 'Vazgeç', style: 'cancel' },
        {
          text: 'Unut',
          style: 'destructive',
          onPress: () => {
            void forgetAll();
          },
        },
      ],
    );
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.colors.bg }}
      contentContainerStyle={[
        styles.content,
        { paddingBottom: insets.bottom + theme.spacing.xxl },
      ]}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={[styles.title, { color: theme.colors.text }]}>DEVA'nın senden hatırladıkları</Text>
      <Text style={[styles.subtitle, { color: theme.colors.muted }]}>
        Buradan düzenleyebilir veya silebilirsin.
      </Text>

      {!adding ? (
        <PrimaryButton theme={theme} label="+ Ekle" variant="secondary" onPress={startAdd} />
      ) : (
        <Card theme={theme} style={styles.card}>
          <TextInput
            value={newContent}
            onChangeText={setNewContent}
            placeholder="Notun ne olduğunu yaz"
            placeholderTextColor={theme.colors.muted}
            maxLength={MAX_LENGTH}
            multiline
            style={[inputStyle(theme), styles.input]}
          />
          <CategoryChips theme={theme} selected={newCategory} onSelect={setNewCategory} />
          <View style={styles.actions}>
            <View style={styles.slot}>
              <PrimaryButton
                theme={theme}
                label="Kaydet"
                onPress={() => {
                  void saveNew();
                }}
                disabled={newContent.trim().length === 0}
              />
            </View>
            <View style={styles.slot}>
              <PrimaryButton theme={theme} label="Vazgeç" variant="secondary" onPress={cancelAdd} />
            </View>
          </View>
        </Card>
      )}

      {loading ? (
        <ActivityIndicator color={theme.colors.muted} />
      ) : notes.length === 0 ? (
        <EmptyState theme={theme} title="Henüz bir şey saklamıyorum." />
      ) : (
        notes.map((note) => {
          const isEditing = note.id === editingId;
          const parsed = new Date(note.updated_at);
          const date = Number.isNaN(parsed.getTime()) ? '' : parsed.toLocaleDateString('tr-TR');

          return (
            <Card key={note.id} theme={theme} style={styles.card}>
              <View style={styles.badgeRow}>
                <Chip theme={theme} label={CATEGORY_LABELS[note.category]} selected />
                <Text style={[styles.source, { color: theme.colors.muted }]}>
                  {note.source === 'ai' ? 'DEVA notu' : 'Sen ekledin'}
                </Text>
              </View>

              {isEditing ? (
                <>
                  <TextInput
                    value={draftContent}
                    onChangeText={setDraftContent}
                    maxLength={MAX_LENGTH}
                    multiline
                    style={[inputStyle(theme), styles.input]}
                  />
                  <CategoryChips
                    theme={theme}
                    selected={draftCategory}
                    onSelect={setDraftCategory}
                  />
                  <View style={styles.actions}>
                    <View style={styles.slot}>
                      <PrimaryButton
                        theme={theme}
                        label="Kaydet"
                        onPress={() => {
                          void saveEdit(note.id);
                        }}
                        disabled={draftContent.trim().length === 0}
                      />
                    </View>
                    <View style={styles.slot}>
                      <PrimaryButton
                        theme={theme}
                        label="Vazgeç"
                        variant="secondary"
                        onPress={cancelEdit}
                      />
                    </View>
                  </View>
                </>
              ) : (
                <>
                  <Text style={[styles.noteBody, { color: theme.colors.text }]}>{note.content}</Text>
                  {date ? (
                    <Text style={[styles.date, { color: theme.colors.muted }]}>{date}</Text>
                  ) : null}
                  <View style={styles.actions}>
                    <Action
                      theme={theme}
                      icon="create-outline"
                      label="Düzenle"
                      onPress={() => startEdit(note)}
                    />
                    <Action
                      theme={theme}
                      icon="trash-outline"
                      label="Sil"
                      color={theme.colors.danger}
                      onPress={() => {
                        void remove(note.id);
                      }}
                    />
                  </View>
                </>
              )}
            </Card>
          );
        })
      )}

      <PrimaryButton
        theme={theme}
        label="Tümünü unut"
        variant="secondary"
        onPress={confirmForgetAll}
        disabled={notes.length === 0}
      />
    </ScrollView>
  );
}

function Action({
  theme,
  icon,
  label,
  onPress,
  color,
}: {
  theme: Theme;
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  color?: string;
}) {
  const tint = color ?? theme.colors.primary;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => [styles.action, { opacity: pressed ? 0.6 : 1 }]}
    >
      <Ionicons name={icon} size={16} color={tint} />
      <Text style={[styles.actionLabel, { color: tint }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: 24,
    gap: 12,
  },
  title: {
    fontSize: 22,
    fontWeight: '600',
    lineHeight: 30,
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 22,
  },
  card: {
    gap: 12,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  source: {
    fontSize: 12,
  },
  noteBody: {
    fontSize: 15,
    lineHeight: 22,
  },
  date: {
    fontSize: 12,
  },
  input: {
    height: 88,
    paddingTop: 12,
    textAlignVertical: 'top',
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
  },
  slot: {
    flex: 1,
  },
  action: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
  },
  actionLabel: {
    fontSize: 15,
    fontWeight: '600',
  },
});
