/**
 * Settings skeleton (HANDOFF.md "Next/pending"). Account info + sign out are
 * real (wired to useAuth). Preferences/Privacy rows are structural stubs —
 * tagged "Soon" — until there's a place to persist them (local prefs store or
 * the Supabase seam).
 */
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { useAuth } from '@/auth/store';
import { useAuthGate } from '@/auth/use-require-auth';
import { PageContainer } from '@/components/page-container';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Palettes, Spacing, type ThemeName } from '@/constants/theme';
import { useTheme, useThemeControls } from '@/hooks/use-theme';
import { useSpotifyConnection } from '@/music/use-spotify-connection';

/** Display names for the theme picker, in presentation order. */
const THEME_LABELS: Record<ThemeName, string> = {
  vinyl: 'Vinyl red',
  cream: 'Cream paper',
};

export default function SettingsScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { user, signOut } = useAuth();
  useAuthGate(); // account settings need an account — bounce guests to sign-in

  return (
    <ThemedView style={styles.screen}>
      <View style={styles.topBar}>
        <Pressable onPress={() => router.back()} accessibilityLabel="Back" hitSlop={8}>
          <Ionicons name="chevron-back" size={26} color={theme.text} />
        </Pressable>
        <ThemedText type="smallBold">Settings</ThemedText>
        <View style={{ width: 26 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <PageContainer style={styles.inner}>
          <Section label="ACCOUNT">
            <Row icon="person-outline" label="Display name" value={user?.displayName} theme={theme} />
            <Row icon="mail-outline" label="Email" value={user?.email} theme={theme} />
            <Row icon="key-outline" label="Change password" soon theme={theme} />
            <Row
              testID="sign-out"
              icon="log-out-outline"
              label="Sign out"
              onPress={signOut}
              danger
              theme={theme}
            />
          </Section>

          <Section label="CONNECTIONS">
            <SpotifyConnectionRow />
          </Section>

          <Section label="APPEARANCE">
            <ThemePicker />
          </Section>

          <Section label="PREFERENCES">
            <Row icon="options-outline" label="Default rating increment" value="0.1" soon theme={theme} />
            <Row icon="notifications-outline" label="Notifications" soon theme={theme} />
          </Section>

          <Section label="PRIVACY">
            <Row icon="eye-outline" label="Profile visibility" value="Public" soon theme={theme} />
            <Row icon="people-outline" label="Friends" soon theme={theme} />
          </Section>

          <Section label="ABOUT">
            <Row icon="information-circle-outline" label="Version" value="1.0.0" theme={theme} />
          </Section>
        </PageContainer>
      </ScrollView>
    </ThemedView>
  );
}

/** Swatch cards for each palette — tap to switch the whole app live. */
function ThemePicker() {
  const theme = useTheme();
  const { name, setName } = useThemeControls();
  return (
    <View style={styles.swatchRow}>
      {(Object.keys(Palettes) as ThemeName[]).map((key) => {
        const palette = Palettes[key];
        const active = key === name;
        return (
          <Pressable
            key={key}
            testID={`theme-${key}`}
            onPress={() => setName(key)}
            accessibilityLabel={`Use the ${THEME_LABELS[key]} theme`}
            style={[
              styles.swatch,
              {
                backgroundColor: palette.background,
                borderColor: active ? theme.accent : theme.backgroundSelected,
                borderWidth: active ? 2 : 1,
              },
            ]}>
            <View style={styles.swatchChips}>
              <View style={[styles.swatchChip, { backgroundColor: palette.accent }]} />
              <View style={[styles.swatchChip, { backgroundColor: palette.accentAlt }]} />
              <View style={[styles.swatchChip, { backgroundColor: palette.backgroundElement }]} />
            </View>
            <ThemedText type="small" style={{ color: palette.text, fontWeight: '600' }}>
              {THEME_LABELS[key]}
            </ThemedText>
            {active && (
              <View style={styles.swatchCheck}>
                <Ionicons name="checkmark-circle" size={18} color={theme.accent} />
              </View>
            )}
          </Pressable>
        );
      })}
    </View>
  );
}

/**
 * Links the viewer's Spotify account (device-local OAuth, shared with the Rate
 * tab's import tray via useSpotifyConnection). Shows connected state with a
 * Connect / Disconnect action; hidden button while the build lacks a client ID.
 */
function SpotifyConnectionRow() {
  const theme = useTheme();
  const { configured, status, busy, error, connect, disconnect } = useSpotifyConnection();
  const connected = status === 'connected';

  const statusText = !configured
    ? 'Not available in this build'
    : status === 'checking'
      ? 'Checking…'
      : connected
        ? 'Connected'
        : 'Not connected';

  return (
    <View style={styles.connectionRow}>
      <Ionicons name="musical-notes" size={19} color={theme.accent} />
      <View style={{ flex: 1 }}>
        <ThemedText type="small">Spotify</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {statusText}
        </ThemedText>
      </View>
      {configured && status !== 'checking' && (
        <Pressable
          testID="spotify-connect"
          onPress={connected ? disconnect : connect}
          disabled={busy}
          accessibilityLabel={connected ? 'Disconnect Spotify' : 'Connect Spotify'}
          style={({ pressed }) => [
            styles.connectPill,
            {
              backgroundColor: connected ? theme.backgroundSelected : theme.accent,
              opacity: pressed || busy ? 0.7 : 1,
            },
          ]}>
          <ThemedText type="smallBold" style={{ color: connected ? theme.text : theme.onAccent }}>
            {busy ? 'Working…' : connected ? 'Disconnect' : 'Connect'}
          </ThemedText>
        </Pressable>
      )}
      {error && (
        <ThemedText type="small" style={[styles.connectionError, { color: theme.danger }]}>
          {error}
        </ThemedText>
      )}
    </View>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <ThemedText type="smallBold" themeColor="textSecondary" style={styles.sectionLabel}>
        {label}
      </ThemedText>
      <View style={styles.sectionBody}>{children}</View>
    </View>
  );
}

function Row({
  testID,
  icon,
  label,
  value,
  soon,
  danger,
  onPress,
  theme,
}: {
  testID?: string;
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value?: string;
  soon?: boolean;
  danger?: boolean;
  onPress?: () => void;
  theme: ReturnType<typeof useTheme>;
}) {
  const interactive = !!onPress;
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      disabled={!interactive}
      style={({ pressed }) => [styles.row, { opacity: interactive && pressed ? 0.6 : 1 }]}>
      <Ionicons name={icon} size={19} color={danger ? theme.danger : theme.textSecondary} />
      <ThemedText type="small" style={[{ flex: 1 }, danger && { color: theme.danger }]}>
        {label}
      </ThemedText>
      {value && (
        <ThemedText type="small" themeColor="textSecondary">
          {value}
        </ThemedText>
      )}
      {soon && (
        <View style={[styles.soon, { backgroundColor: theme.backgroundSelected }]}>
          <ThemedText type="small" themeColor="textSecondary" style={{ fontSize: 11 }}>
            Soon
          </ThemedText>
        </View>
      )}
      {interactive && !danger && (
        <Ionicons name="chevron-forward" size={16} color={theme.textSecondary} />
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing.three,
  },
  content: { padding: Spacing.three },
  inner: { gap: Spacing.four },
  section: { gap: Spacing.two },
  sectionLabel: {},
  sectionBody: { gap: Spacing.one },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, paddingVertical: Spacing.two },
  soon: { borderRadius: 999, paddingHorizontal: Spacing.two, paddingVertical: 1 },
  connectionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: Spacing.three,
    paddingVertical: Spacing.two,
  },
  connectPill: {
    borderRadius: 999,
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.two,
  },
  connectionError: { width: '100%' },
  swatchRow: { flexDirection: 'row', gap: Spacing.two },
  swatch: {
    flex: 1,
    borderRadius: 12,
    padding: Spacing.three,
    gap: Spacing.two,
  },
  swatchChips: { flexDirection: 'row', gap: Spacing.one },
  swatchChip: { width: 18, height: 18, borderRadius: 9 },
  swatchCheck: { position: 'absolute', top: Spacing.two, right: Spacing.two },
});
