import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { DisplayFont, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

const SPOTIFY_GREEN = '#1DB954';

export function BrandHeader({ tagline }: { tagline: string }) {
  return (
    <View style={styles.brand}>
      <ThemedText style={styles.logo}>Jelli</ThemedText>
      <ThemedText themeColor="textSecondary">{tagline}</ThemedText>
    </View>
  );
}

/**
 * "Continue with Spotify" — starts the Supabase Spotify OAuth flow. On web the
 * page redirects out to Spotify, so `busy` shows a brief redirecting state.
 */
export function SpotifyButton({
  onPress,
  busy,
  label = 'Continue with Spotify',
}: {
  onPress: () => void;
  busy?: boolean;
  label?: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={busy}
      accessibilityLabel={label}
      style={({ pressed }) => [styles.spotify, { opacity: pressed || busy ? 0.85 : 1 }]}>
      <Ionicons name="musical-notes" size={18} color="#fff" />
      <ThemedText type="smallBold" style={{ color: '#fff' }}>
        {busy ? 'Redirecting…' : label}
      </ThemedText>
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
  logo: { fontSize: 42, lineHeight: 50, fontFamily: DisplayFont },
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
  dividerRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, alignSelf: 'stretch' },
  line: { flex: 1, height: 1 },
});
