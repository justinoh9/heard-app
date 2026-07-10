/**
 * Full-screen "sign in to do this" placeholder, shown where a signed-out guest
 * hits an account-only surface (e.g. the Profile tab). Browsing stays open;
 * this only guards the personal/owned views.
 */

import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import { ThemedText } from './themed-text';
import { ThemedView } from './themed-view';

export function GuestGate({
  icon = 'person-circle-outline',
  title,
  message,
  showSettings = false,
}: {
  icon?: keyof typeof Ionicons.glyphMap;
  title: string;
  message: string;
  /** Show a settings gear (top-right) so guests can still reach Appearance. */
  showSettings?: boolean;
}) {
  const theme = useTheme();
  const router = useRouter();
  return (
    <ThemedView style={styles.screen}>
      {showSettings && (
        <Pressable
          testID="guest-settings"
          onPress={() => router.push('/settings')}
          accessibilityLabel="Settings"
          hitSlop={8}
          style={({ pressed }) => [styles.settingsBtn, { opacity: pressed ? 0.6 : 1 }]}>
          <Ionicons name="settings-outline" size={22} color={theme.textSecondary} />
        </Pressable>
      )}
      <View style={styles.inner}>
        <Ionicons name={icon} size={52} color={theme.textSecondary} />
        <ThemedText type="subtitle" style={styles.center}>
          {title}
        </ThemedText>
        <ThemedText themeColor="textSecondary" style={styles.center}>
          {message}
        </ThemedText>
        <Pressable
          testID="guest-signin"
          onPress={() => router.push('/(auth)/sign-in')}
          style={({ pressed }) => [
            styles.button,
            { backgroundColor: theme.accent, opacity: pressed ? 0.7 : 1 },
          ]}>
          <ThemedText type="smallBold" style={{ color: theme.onAccent }}>
            Sign in or create account
          </ThemedText>
        </Pressable>
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  settingsBtn: { position: 'absolute', top: Spacing.five, right: Spacing.four, zIndex: 1, padding: Spacing.two },
  inner: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.three,
    padding: Spacing.five,
  },
  center: { textAlign: 'center' },
  button: {
    marginTop: Spacing.two,
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.five,
    borderRadius: 12,
  },
});
