/**
 * Profile avatar: the user's uploaded image when present (ROADMAP G4), else a
 * themed initials monogram — the fallback every profile surface used before
 * uploads existed. One component so the image/initials logic lives in one place.
 */

import { Image } from 'expo-image';
import { StyleSheet, View } from 'react-native';

import { useTheme } from '@/hooks/use-theme';
import { initialsOf } from '@/social/feed-rows';

import { ThemedText } from './themed-text';

type Props = {
  /** Display name — drives the initials fallback. */
  name: string;
  /** Uploaded avatar URL; falls back to initials when absent. */
  uri?: string | null;
  /** Diameter in px (default 44). */
  size?: number;
};

export function Avatar({ name, uri, size = 44 }: Props) {
  const theme = useTheme();
  const radius = size / 2;

  if (uri) {
    return (
      <Image
        source={{ uri }}
        style={{ width: size, height: size, borderRadius: radius }}
        contentFit="cover"
        transition={150}
        accessibilityLabel={`${name}'s avatar`}
      />
    );
  }

  return (
    <View
      style={[
        styles.fallback,
        { width: size, height: size, borderRadius: radius, backgroundColor: theme.backgroundSelected },
      ]}>
      <ThemedText type="smallBold" style={{ fontSize: Math.max(12, size * 0.32) }}>
        {initialsOf(name)}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  fallback: { alignItems: 'center', justifyContent: 'center' },
});
