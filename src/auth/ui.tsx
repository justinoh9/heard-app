import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

const SPOTIFY_GREEN = '#1DB954';

export function BrandHeader({ tagline }: { tagline: string }) {
  return (
    <View style={styles.brand}>
      <ThemedText style={styles.logo}>Heard</ThemedText>
      <ThemedText themeColor="textSecondary">{tagline}</ThemedText>
    </View>
  );
}

/**
 * Stubbed "Continue with Spotify" — shown now, wired up when the Spotify
 * integration lands (SPEC §2 fast-follow). Tapping surfaces a coming-soon note.
 */
export function SpotifyButton({ onPress }: { onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.spotify, { opacity: pressed ? 0.85 : 1 }]}>
      <Ionicons name="musical-notes" size={18} color="#fff" />
      <ThemedText type="smallBold" style={{ color: '#fff' }}>
        Continue with Spotify
      </ThemedText>
      <View style={styles.soon}>
        <ThemedText type="small" style={{ color: SPOTIFY_GREEN, fontSize: 11 }}>
          Soon
        </ThemedText>
      </View>
    </Pressable>
  );
}

export function OrDivider() {
  const theme = useTheme();
  return (
    <View style={styles.dividerRow}>
      <View style={[styles.line, { backgroundColor: theme.backgroundElement }]} />
      <ThemedText type="small" themeColor="textSecondary">
        or
      </ThemedText>
      <View style={[styles.line, { backgroundColor: theme.backgroundElement }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  brand: { alignItems: 'center', gap: Spacing.one, marginBottom: Spacing.two },
  logo: { fontSize: 40, fontWeight: 700, lineHeight: 46 },
  spotify: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    backgroundColor: SPOTIFY_GREEN,
    paddingVertical: Spacing.three,
    borderRadius: 999,
    alignSelf: 'stretch',
  },
  soon: {
    backgroundColor: '#fff',
    borderRadius: 999,
    paddingHorizontal: Spacing.two,
    paddingVertical: 1,
  },
  dividerRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, alignSelf: 'stretch' },
  line: { flex: 1, height: 1 },
});
