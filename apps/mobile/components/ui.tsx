import type { ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import type { Theme } from '../lib/theme';

export function inputStyle(theme: Theme): TextStyle {
  return {
    height: 52,
    borderRadius: theme.radius,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    color: theme.colors.text,
    paddingHorizontal: theme.spacing.lg,
    fontSize: theme.type.body,
  };
}

export function Card({
  theme,
  style,
  children,
}: {
  theme: Theme;
  style?: StyleProp<ViewStyle>;
  children: ReactNode;
}) {
  return (
    <View
      style={[
        {
          backgroundColor: theme.colors.surface,
          borderRadius: theme.radius,
          borderWidth: 1,
          borderColor: theme.colors.border,
          padding: theme.spacing.lg,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

export function SectionTitle({ theme, children }: { theme: Theme; children: ReactNode }) {
  return (
    <Text style={[styles.sectionTitle, { color: theme.colors.muted }]}>{children}</Text>
  );
}

export function PrimaryButton({
  theme,
  label,
  onPress,
  busy,
  variant = 'primary',
  disabled,
}: {
  theme: Theme;
  label: string;
  onPress: () => void;
  busy?: boolean;
  variant?: 'primary' | 'secondary' | 'danger';
  disabled?: boolean;
}) {
  const background =
    variant === 'primary'
      ? theme.colors.primary
      : variant === 'danger'
        ? theme.colors.surface
        : theme.colors.surface;

  const foreground =
    variant === 'primary'
      ? theme.colors.surface
      : variant === 'danger'
        ? theme.colors.danger
        : theme.colors.text;

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || busy}
      accessibilityRole="button"
      accessibilityState={{ disabled: Boolean(disabled || busy) }}
      style={({ pressed }) => [
        styles.button,
        {
          borderRadius: theme.radius,
          backgroundColor: background,
          borderWidth: variant === 'primary' ? 0 : 1,
          borderColor: variant === 'danger' ? theme.colors.danger : theme.colors.border,
          opacity: pressed || disabled ? 0.6 : 1,
        },
      ]}
    >
      {busy ? (
        <ActivityIndicator color={foreground} />
      ) : (
        <Text style={[styles.buttonLabel, { color: foreground }]}>{label}</Text>
      )}
    </Pressable>
  );
}

export function Chip({
  theme,
  label,
  selected,
  onPress,
}: {
  theme: Theme;
  label: string;
  selected?: boolean;
  onPress?: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      style={[
        styles.chip,
        {
          borderRadius: theme.radius,
          backgroundColor: selected ? theme.colors.primarySoft : theme.colors.surface,
          borderColor: selected ? theme.colors.primary : theme.colors.border,
        },
      ]}
    >
      <Text style={[styles.chipLabel, { color: theme.colors.text }]}>{label}</Text>
    </Pressable>
  );
}

export function EmptyState({ theme, title, body }: { theme: Theme; title: string; body?: string }) {
  return (
    <View style={styles.empty}>
      <Text style={[styles.emptyTitle, { color: theme.colors.text }]}>{title}</Text>
      {body ? <Text style={[styles.emptyBody, { color: theme.colors.muted }]}>{body}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  sectionTitle: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  button: {
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  buttonLabel: {
    fontSize: 16,
    fontWeight: '600',
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderWidth: 1,
    marginRight: 8,
  },
  chipLabel: {
    fontSize: 14,
  },
  empty: {
    alignItems: 'center',
    paddingVertical: 48,
    paddingHorizontal: 24,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '600',
    textAlign: 'center',
  },
  emptyBody: {
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
    marginTop: 8,
  },
});