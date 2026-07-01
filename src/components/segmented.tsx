import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export interface SegmentedOption {
  key: string;
  label: string;
}

/**
 * Two-or-more-option pill toggle. Shared by the leaderboard scope switch and the
 * comment scope filter so they stay visually consistent.
 */
export function Segmented({
  options,
  value,
  onChange,
  testIDPrefix,
  style,
}: {
  options: SegmentedOption[];
  value: string;
  onChange: (key: string) => void;
  /** Per-segment testID is `${testIDPrefix}-${key}` when provided. */
  testIDPrefix?: string;
  style?: object;
}) {
  const theme = useTheme();
  return (
    <View style={[styles.segmented, { backgroundColor: theme.backgroundElement }, style]}>
      {options.map((o) => {
        const active = o.key === value;
        return (
          <Pressable
            key={o.key}
            testID={testIDPrefix ? `${testIDPrefix}-${o.key}` : undefined}
            onPress={() => onChange(o.key)}
            style={[styles.segment, active && { backgroundColor: theme.backgroundSelected }]}>
            <ThemedText type="smallBold" themeColor={active ? 'text' : 'textSecondary'}>
              {o.label}
            </ThemedText>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  segmented: { flexDirection: 'row', borderRadius: 10, padding: 3 },
  segment: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
    borderRadius: 8,
  },
});
