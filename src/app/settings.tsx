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
import { PageContainer } from '@/components/page-container';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Modes, Spacing, type Appearance, type ModeName, type Variant } from '@/constants/theme';
import { useTheme, useThemeControls } from '@/hooks/use-theme';
import { useSpotifyConnection } from '@/music/use-spotify-connection';

/** Appearance toggle options, in presentation order. */
const APPEARANCE_OPTIONS: { key: Appearance; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { key: 'light', label: 'Light', icon: 'sunny-outline' },
  { key: 'dark', label: 'Dark', icon: 'moon-outline' },
  { key: 'system', label: 'System', icon: 'phone-portrait-outline' },
];

export default function SettingsScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { user, signOut } = useAuth();
  // Settings is open to guests so anyone can change the theme (appearance is a
  // device preference, not an account one). Only the ACCOUNT section is gated.

  return (
    <ThemedView style={styles.screen}>
      <View style={styles.topBar}>
        <Pressable
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
          accessibilityLabel="Back"
          hitSlop={8}>
          <Ionicons name="chevron-back" size={26} color={theme.text} />
        </Pressable>
        <ThemedText type="smallBold">Settings</ThemedText>
        <View style={{ width: 26 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <PageContainer style={styles.inner}>
          <Section label="ACCOUNT">
            {user ? (
              <>
                <Row icon="person-outline" label="Display name" value={user.displayName} theme={theme} />
                <Row icon="mail-outline" label="Email" value={user.email} theme={theme} />
                <Row icon="key-outline" label="Change password" soon theme={theme} />
                <Row
                  testID="sign-out"
                  icon="log-out-outline"
                  label="Sign out"
                  onPress={signOut}
                  danger
                  theme={theme}
                />
              </>
            ) : (
              <Row
                testID="settings-signin"
                icon="log-in-outline"
                label="Sign in or create account"
                onPress={() => router.push('/(auth)/sign-in')}
                theme={theme}
              />
            )}
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

          <Section label="PRIVACY & SAFETY">
            <Row
              icon="ban-outline"
              label="Blocked accounts"
              onPress={() => router.push('/blocked')}
              theme={theme}
            />
            <Row icon="eye-outline" label="Profile visibility" value="Public" soon theme={theme} />
            <Row icon="people-outline" label="Friends" soon theme={theme} />
          </Section>

          <Section label="ABOUT">
            <Row
              icon="sparkles-outline"
              label="About Jelli"
              onPress={() => router.push('/about')}
              theme={theme}
            />
            <Row
              icon="shield-checkmark-outline"
              label="Privacy policy"
              onPress={() => router.push('/privacy')}
              theme={theme}
            />
            <Row icon="information-circle-outline" label="Version" value="1.0.0" theme={theme} />
          </Section>
        </PageContainer>
      </ScrollView>
    </ThemedView>
  );
}

/**
 * The theme switcher: appearance toggle (light/dark/system) + a card per visual
 * mode + palette-variant chips for the active mode. Tapping any control swaps
 * the whole app live via useThemeControls().
 */
function ThemePicker() {
  const theme = useTheme();
  const { selection, setMode, setVariant, setAppearance } = useThemeControls();
  const modeKeys = Object.keys(Modes) as ModeName[];
  const variants = Modes[selection.mode].variants as Record<string, Variant>;
  const variantKeys = Object.keys(variants);
  // Which side of each palette to preview, matching the chosen appearance.
  const previewDark = selection.appearance === 'dark' || (selection.appearance === 'system' && theme.isDark);

  return (
    <View style={{ gap: Spacing.three }}>
      <View style={[styles.segment, { backgroundColor: theme.backgroundSelected }]}>
        {APPEARANCE_OPTIONS.map((opt) => {
          const active = selection.appearance === opt.key;
          return (
            <Pressable
              key={opt.key}
              testID={`appearance-${opt.key}`}
              onPress={() => setAppearance(opt.key)}
              accessibilityLabel={`${opt.label} appearance`}
              style={[styles.segmentItem, active && { backgroundColor: theme.accent }]}>
              <Ionicons name={opt.icon} size={15} color={active ? theme.onAccent : theme.textSecondary} />
              <ThemedText type="small" style={{ color: active ? theme.onAccent : theme.text, fontWeight: '600' }}>
                {opt.label}
              </ThemedText>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.modeGrid}>
        {modeKeys.map((key) => {
          const mode = Modes[key];
          const active = key === selection.mode;
          const preview = Object.values(mode.variants)[0] as Variant;
          const p = previewDark ? preview.dark : preview.light;
          return (
            <Pressable
              key={key}
              testID={`mode-${key}`}
              onPress={() => setMode(key)}
              accessibilityLabel={`Use the ${mode.label} theme`}
              style={[
                styles.modeCard,
                { backgroundColor: p.background, borderColor: active ? theme.accent : theme.backgroundSelected, borderWidth: active ? 2 : 1 },
              ]}>
              <View style={styles.swatchChips}>
                <View style={[styles.swatchChip, { backgroundColor: p.accent }]} />
                <View style={[styles.swatchChip, { backgroundColor: p.accentAlt }]} />
                <View style={[styles.swatchChip, { backgroundColor: p.backgroundElement }]} />
              </View>
              <ThemedText type="small" style={{ color: p.text, fontWeight: '600' }}>
                {mode.label}
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

      {variantKeys.length > 1 && (
        <View style={styles.variantRow}>
          {variantKeys.map((vkey) => {
            const active = vkey === selection.variant;
            const vp = previewDark ? variants[vkey].dark : variants[vkey].light;
            return (
              <Pressable
                key={vkey}
                testID={`variant-${vkey}`}
                onPress={() => setVariant(vkey)}
                accessibilityLabel={`${variants[vkey].label} palette`}
                style={[
                  styles.variantChip,
                  { backgroundColor: active ? theme.accentSoft : theme.backgroundElement, borderColor: active ? theme.accent : 'transparent' },
                ]}>
                <View style={[styles.variantDot, { backgroundColor: vp.accent }]} />
                <ThemedText type="small" style={{ color: theme.text }}>
                  {variants[vkey].label}
                </ThemedText>
              </Pressable>
            );
          })}
        </View>
      )}
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
      // Without these a navigational row is an unlabelled generic to a screen
      // reader. The "Soon" rows aren't pressable, so they stay plain text.
      accessibilityRole={interactive ? 'button' : undefined}
      accessibilityLabel={interactive ? label : undefined}
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
  segment: { flexDirection: 'row', borderRadius: 999, padding: 3 },
  segmentItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.one,
    paddingVertical: Spacing.two,
    borderRadius: 999,
  },
  modeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  modeCard: {
    flexBasis: '48%',
    flexGrow: 1,
    borderRadius: 12,
    padding: Spacing.three,
    gap: Spacing.two,
  },
  variantRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  variantChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: 999,
    borderWidth: 1,
  },
  variantDot: { width: 14, height: 14, borderRadius: 7 },
  swatchChips: { flexDirection: 'row', gap: Spacing.one },
  swatchChip: { width: 18, height: 18, borderRadius: 9 },
  swatchCheck: { position: 'absolute', top: Spacing.two, right: Spacing.two },
});
