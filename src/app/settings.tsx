/**
 * Settings skeleton (HANDOFF.md "Next/pending"). Account info + sign out are
 * real (wired to useAuth). Preferences/Privacy rows are structural stubs —
 * tagged "Soon", same convention as SpotifyButton (src/auth/ui.tsx) — until
 * there's a place to persist them (local prefs store or the Supabase seam).
 */
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { useAuth } from '@/auth/store';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export default function SettingsScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { user, signOut } = useAuth();

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

        <Section label="PREFERENCES">
          <Row icon="contrast-outline" label="Appearance" value="System" soon theme={theme} />
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
      </ScrollView>
    </ThemedView>
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
      <Ionicons name={icon} size={19} color={danger ? '#E24B4A' : theme.textSecondary} />
      <ThemedText type="small" style={[{ flex: 1 }, danger && { color: '#E24B4A' }]}>
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
  content: { padding: Spacing.three, gap: Spacing.four },
  section: { gap: Spacing.two },
  sectionLabel: {},
  sectionBody: { gap: Spacing.one },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, paddingVertical: Spacing.two },
  soon: { borderRadius: 999, paddingHorizontal: Spacing.two, paddingVertical: 1 },
});
