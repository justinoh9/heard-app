/**
 * Desktop-only top nav bar, swapped in for the bottom tab bar at
 * `Breakpoints.desktop` — see `src/app/(tabs)/_layout.tsx`. Mirrors the
 * bottom tabs' four routes; content is `PageContainer`-wrapped so it aligns
 * with the page column beneath it, Letterboxd/Beli-style.
 */

import { Ionicons } from '@expo/vector-icons';
import { useRouter, usePathname } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { PageContainer } from '@/components/page-container';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

const LINKS = [
  { href: '/', label: 'Feed', match: '/' },
  { href: '/rate', label: 'Rate', match: '/rate' },
  { href: '/leaderboard', label: 'Ranks', match: '/leaderboard' },
  { href: '/profile', label: 'Profile', match: '/profile' },
] as const;

export function TopNavBar() {
  const theme = useTheme();
  const router = useRouter();
  const pathname = usePathname();

  return (
    <ThemedView style={[styles.bar, { borderBottomColor: theme.backgroundElement }]}>
      <PageContainer style={styles.row}>
        <ThemedText style={styles.logo}>Heard</ThemedText>

        <View style={styles.links}>
          {LINKS.map((link) => {
            const active = pathname === link.match;
            return (
              <Pressable
                key={link.href}
                onPress={() => router.push(link.href)}
                style={[styles.link, active && { backgroundColor: theme.backgroundSelected }]}>
                <ThemedText type="smallBold" themeColor={active ? 'text' : 'textSecondary'}>
                  {link.label}
                </ThemedText>
              </Pressable>
            );
          })}
        </View>

        <Pressable
          onPress={() => router.push('/settings')}
          accessibilityLabel="Settings"
          style={({ pressed }) => [
            styles.settingsBtn,
            { backgroundColor: theme.backgroundElement, opacity: pressed ? 0.6 : 1 },
          ]}>
          <Ionicons name="settings-outline" size={18} color={theme.textSecondary} />
        </Pressable>
      </PageContainer>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  bar: { borderBottomWidth: 1 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 60,
    paddingHorizontal: Spacing.three,
  },
  logo: { fontSize: 20, fontWeight: 700 },
  links: { flexDirection: 'row', gap: Spacing.one },
  link: { paddingVertical: Spacing.two, paddingHorizontal: Spacing.three, borderRadius: 8 },
  settingsBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
