import { Linking, StyleSheet, Text, View } from 'react-native';
import { CRISIS_SOFT_SUPPORT_TEXT } from '@shared/crisis';
import type { Theme } from '../../lib/theme';
import { PrimaryButton } from '../ui';

interface CrisisCardProps {
  theme: Theme;
  /**
   * Verildiğinde kart "karar" hâlindedir: kullanıcı konuşmaya devam edebilir
   * ya da kriz ekranını açabilir. Verilmezse kart kalıcı hâle gelir ve
   * yalnızca yardım hatlarını gösterir.
   */
  onContinue?: () => void;
  onOpenCrisis: () => void;
}

/**
 * Sohbet içindeki kriz kartı. Ton sakin kalır: kırmızı şerit, alarm
 * sözcüğü ya da kırmızı buton yoktur; renkler tema paletinden gelir.
 */
export function CrisisCard({ theme, onContinue, onOpenCrisis }: CrisisCardProps) {
  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: theme.colors.primarySoft,
          borderColor: theme.colors.border,
          borderRadius: theme.radius,
          padding: theme.spacing.lg,
        },
      ]}
    >
      {onContinue ? (
        <>
          <Text
            style={[
              styles.text,
              { color: theme.colors.text, fontSize: theme.type.body, lineHeight: theme.type.bodyLineHeight },
            ]}
          >
            İstersen konuşmaya devam edebilirsin.
          </Text>
          <View style={[styles.buttons, { marginTop: theme.spacing.md }]}>
            <View style={styles.grow}>
              <PrimaryButton theme={theme} label="Devam et" onPress={onContinue} />
            </View>
            <View style={styles.grow}>
              <PrimaryButton
                theme={theme}
                label="Kriz ekranını aç"
                variant="secondary"
                onPress={onOpenCrisis}
              />
            </View>
          </View>
        </>
      ) : (
        <>
          <Text
            style={[
              styles.text,
              { color: theme.colors.text, fontSize: theme.type.body, lineHeight: theme.type.bodyLineHeight },
            ]}
          >
            {CRISIS_SOFT_SUPPORT_TEXT}
          </Text>
          <View style={[styles.buttons, { marginTop: theme.spacing.md }]}>
            <View style={styles.grow}>
              <PrimaryButton
                theme={theme}
                label="ALO 182"
                variant="secondary"
                onPress={() => {
                  void Linking.openURL('tel:182');
                }}
              />
            </View>
            <View style={styles.grow}>
              <PrimaryButton
                theme={theme}
                label="112"
                variant="secondary"
                onPress={() => {
                  void Linking.openURL('tel:112');
                }}
              />
            </View>
          </View>
          <View style={{ marginTop: theme.spacing.sm }}>
            <PrimaryButton theme={theme} label="Kriz ekranı" onPress={onOpenCrisis} />
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
  },
  text: {
    fontWeight: '600',
  },
  buttons: {
    flexDirection: 'row',
    gap: 8,
  },
  grow: {
    flex: 1,
  },
});