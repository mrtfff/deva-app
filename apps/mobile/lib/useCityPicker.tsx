import { useCallback, useMemo, useState } from 'react';
import { FlatList, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CITIES, type City } from '@shared/cities';
import { useTheme } from '../components/ThemeProvider';

/**
 * Kurumlar ekranında konum izni reddedildiğinde açılan il seçici.
 * İl listesi tek kaynaktan (`@shared/cities`) gelir.
 */
export function useCityPicker() {
  const [visible, setVisible] = useState(false);
  const [selected, setSelected] = useState<City | null>(null);

  const open = useCallback(() => setVisible(true), []);
  const close = useCallback(() => setVisible(false), []);
  const select = useCallback((city: City) => {
    setSelected(city);
    setVisible(false);
  }, []);

  return { visible, open, close, cities: CITIES, selected, select };
}

export interface CityPickerModalProps {
  visible: boolean;
  cities: readonly City[];
  selected: City | null;
  onSelect: (city: City) => void;
  onClose: () => void;
}

export function CityPickerModal({
  visible,
  cities,
  selected,
  onSelect,
  onClose,
}: CityPickerModalProps) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();

  const sorted = useMemo(
    () => [...cities].sort((a, b) => a.name.localeCompare(b.name, 'tr')),
    [cities],
  );

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View
        style={[
          styles.backdrop,
          { backgroundColor: theme.dark ? 'rgba(0,0,0,0.65)' : 'rgba(28,36,34,0.35)' },
        ]}
      >
        <View
          style={[
            styles.sheet,
            {
              backgroundColor: theme.colors.surface,
              borderTopLeftRadius: theme.radius,
              borderTopRightRadius: theme.radius,
              paddingTop: theme.spacing.lg,
              paddingBottom: insets.bottom + theme.spacing.lg,
            },
          ]}
        >
          <View style={[styles.header, { paddingHorizontal: theme.spacing.lg }]}>
            <Text style={[styles.title, { color: theme.colors.text }]}>İl seç</Text>
            <Pressable onPress={onClose} accessibilityRole="button" hitSlop={12}>
              <Text style={[styles.close, { color: theme.colors.muted }]}>Kapat</Text>
            </Pressable>
          </View>

          <FlatList
            data={sorted}
            keyExtractor={(item) => item.name}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item }) => {
              const isSelected = selected?.name === item.name;
              return (
                <Pressable
                  onPress={() => onSelect(item)}
                  accessibilityRole="button"
                  style={({ pressed }) => [
                    styles.row,
                    {
                      paddingHorizontal: theme.spacing.lg,
                      backgroundColor: pressed ? theme.colors.surfaceAlt : 'transparent',
                    },
                  ]}
                >
                  <Text style={[styles.rowLabel, { color: theme.colors.text }]}>{item.name}</Text>
                  {isSelected ? (
                    <Text style={[styles.selected, { color: theme.colors.primary }]}>Seçili</Text>
                  ) : null}
                </Pressable>
              );
            }}
          />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheet: {
    maxHeight: '80%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 12,
  },
  title: {
    fontSize: 17,
    fontWeight: '600',
  },
  close: {
    fontSize: 15,
  },
  row: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  rowLabel: {
    fontSize: 15,
    lineHeight: 22,
  },
  selected: {
    fontSize: 12,
    fontWeight: '600',
  },
});