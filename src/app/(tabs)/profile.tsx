import { Ionicons } from '@expo/vector-icons';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { PROFILE } from '@/data/catalog';
import { useAuth } from '@/auth/store';
import { useRatings } from '@/data/store';
import { useTheme } from '@/hooks/use-theme';

const BADGE_TINTS = ['#993556', '#854F0B', '#185FA5'];

function initialsFrom(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  return (parts[0][0] + (parts[1]?.[0] ?? '')).toUpperCase();
}

export default function ProfileScreen() {
  const theme = useTheme();
  const { ranked } = useRatings();
  const { user, signOut } = useAuth();

  const displayName = user?.displayName ?? PROFILE.username;
  const initials = user ? initialsFrom(user.displayName) : PROFILE.initials;

  return (
    <ThemedView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <View style={[styles.avatar, { backgroundColor: theme.backgroundSelected }]}>
            <ThemedText type="smallBold">{initials}</ThemedText>
          </View>
          <View style={{ flex: 1 }}>
            <ThemedText type="smallBold" style={{ fontSize: 18 }}>
              {displayName}
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {PROFILE.tags} · {ranked.length} rated
            </ThemedText>
          </View>
          <Pressable
            onPress={signOut}
            accessibilityLabel="Sign out"
            style={({ pressed }) => [
              styles.signOut,
              { backgroundColor: theme.backgroundElement, opacity: pressed ? 0.6 : 1 },
            ]}>
            <Ionicons name="log-out-outline" size={18} color={theme.textSecondary} />
          </Pressable>
        </View>

        {user && (
          <ThemedText type="small" themeColor="textSecondary" style={{ marginTop: -Spacing.one }}>
            {user.email}
          </ThemedText>
        )}

        <View style={styles.stats}>
          <Stat value={String(ranked.length)} label="rated" theme={theme} />
          <Stat value={String(PROFILE.shows)} label="shows" theme={theme} />
          <Stat value={`${PROFILE.streak}🔥`} label="streak" theme={theme} />
        </View>

        <ThemedText type="smallBold" themeColor="textSecondary" style={styles.sectionLabel}>
          TOP RANKED
        </ThemedText>
        {ranked.slice(0, 5).map((r, i) => (
          <View key={r.item.id} style={[styles.rankRow, { backgroundColor: theme.backgroundElement }]}>
            <ThemedText type="smallBold" themeColor="textSecondary" style={styles.rankNum}>
              {i + 1}
            </ThemedText>
            <Ionicons name="musical-notes" size={16} color={theme.textSecondary} />
            <View style={{ flex: 1 }}>
              <ThemedText type="small">{r.item.title}</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {r.item.artist}
              </ThemedText>
            </View>
            <ThemedText type="smallBold" style={{ color: '#1D9E75' }}>
              {r.score.toFixed(1)}
            </ThemedText>
          </View>
        ))}

        <ThemedText type="smallBold" themeColor="textSecondary" style={styles.sectionLabel}>
          CONCERT BADGES
        </ThemedText>
        <View style={styles.badges}>
          {PROFILE.badges.map((b, i) => (
            <View key={b.id} style={[styles.badge, { backgroundColor: theme.backgroundElement }]}>
              <Ionicons name="mic" size={22} color={BADGE_TINTS[i % BADGE_TINTS.length]} />
              <ThemedText type="small" style={{ marginTop: 4 }}>
                {b.artist} &apos;{b.year}
              </ThemedText>
            </View>
          ))}
        </View>
      </ScrollView>
    </ThemedView>
  );
}

function Stat({
  value,
  label,
  theme,
}: {
  value: string;
  label: string;
  theme: ReturnType<typeof useTheme>;
}) {
  return (
    <View style={[styles.stat, { backgroundColor: theme.backgroundElement }]}>
      <ThemedText type="subtitle" style={{ fontSize: 22 }}>
        {value}
      </ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        {label}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { padding: Spacing.three, gap: Spacing.three },
  header: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  avatar: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center' },
  signOut: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  stats: { flexDirection: 'row', gap: Spacing.two },
  stat: { flex: 1, alignItems: 'center', paddingVertical: Spacing.three, borderRadius: 10, gap: 2 },
  sectionLabel: { marginTop: Spacing.two },
  rankRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, padding: Spacing.three, borderRadius: 10 },
  rankNum: { width: 16 },
  badges: { flexDirection: 'row', gap: Spacing.two },
  badge: { flex: 1, alignItems: 'center', paddingVertical: Spacing.three, borderRadius: 12 },
});
