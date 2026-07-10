import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, View } from 'react-native';

import { AnimatedWordmark } from '@/components/animated-wordmark';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useDisplayFont, useTheme } from '@/hooks/use-theme';
import type { OAuthProvider } from './types';

export function BrandHeader({ tagline }: { tagline: string }) {
  const displayFont = useDisplayFont();
  const theme = useTheme();
  return (
    <View style={styles.brand}>
      <AnimatedWordmark text="jelli" style={[styles.logo, { fontFamily: displayFont, color: theme.text }]} />
      <ThemedText themeColor="textSecondary">{tagline}</ThemedText>
    </View>
  );
}

/** Per-provider chrome for the OAuth buttons — brand color, label, and icon. */
const PROVIDER: Record<
  OAuthProvider,
  { label: string; bg: string; fg: string; icon: keyof typeof Ionicons.glyphMap; border?: string }
> = {
  google: { label: 'Continue with Google', bg: '#ffffff', fg: '#1f1f1f', icon: 'logo-google', border: 'rgba(0,0,0,0.15)' },
  apple: { label: 'Continue with Apple', bg: '#000000', fg: '#ffffff', icon: 'logo-apple' },
  spotify: { label: 'Continue with Spotify', bg: '#1DB954', fg: '#ffffff', icon: 'musical-notes' },
};

/**
 * "Continue with <provider>" — starts the Supabase OAuth flow for that provider.
 * On web the page redirects out, so `busy` shows a brief redirecting state.
 */
export function OAuthButton({
  provider,
  onPress,
  busy,
}: {
  provider: OAuthProvider;
  onPress: () => void;
  busy?: boolean;
}) {
  const p = PROVIDER[provider];
  return (
    <Pressable
      onPress={onPress}
      disabled={busy}
      accessibilityLabel={p.label}
      style={({ pressed }) => [
        styles.oauth,
        {
          backgroundColor: p.bg,
          borderColor: p.border ?? 'transparent',
          borderWidth: p.border ? StyleSheet.hairlineWidth : 0,
          opacity: pressed || busy ? 0.85 : 1,
        },
      ]}>
      <Ionicons name={p.icon} size={18} color={p.fg} />
      <ThemedText type="smallBold" style={{ color: p.fg }}>
        {busy ? 'Redirecting…' : p.label}
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
  logo: { fontSize: 42, lineHeight: 50 },
  oauth: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.three,
    borderRadius: 999,
    alignSelf: 'stretch',
  },
  dividerRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, alignSelf: 'stretch' },
  line: { flex: 1, height: 1 },
});
