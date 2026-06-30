import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type Props = {
  icon: keyof typeof Ionicons.glyphMap;
  message: string;
  ctaLabel?: string;
  onPressCta?: () => void;
};

export function EmptyState({ icon, message, ctaLabel, onPressCta }: Props) {
  const theme = useTheme();
  return (
    <View style={styles.empty}>
      <Ionicons name={icon} size={32} color={theme.textSecondary} />
      <ThemedText type="small" themeColor="textSecondary" style={styles.center}>
        {message}
      </ThemedText>
      {ctaLabel && onPressCta && (
        <Pressable
          onPress={onPressCta}
          style={({ pressed }) => [styles.cta, { backgroundColor: '#1D9E75', opacity: pressed ? 0.7 : 1 }]}>
          <ThemedText type="smallBold" style={{ color: '#fff' }}>
            {ctaLabel}
          </ThemedText>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  empty: { alignItems: 'center', gap: Spacing.two, paddingVertical: Spacing.six },
  center: { textAlign: 'center' },
  cta: {
    marginTop: Spacing.two,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.four,
    borderRadius: 12,
  },
});
