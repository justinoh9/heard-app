import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { Segmented } from '@/components/segmented';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useAuth } from '@/auth/store';
import { PROFILE } from '@/data/catalog';
import { useRatings } from '@/data/store';
import { useTheme } from '@/hooks/use-theme';
import { LEADERBOARD_USERS, METRICS, type LeaderboardUser, type MetricKey } from '@/leaderboard/data';

type Scope = 'friends' | 'global';

const MEDALS = ['#EFA72A', '#9AA0A6', '#C77B3B']; // gold, silver, bronze

function initialsFrom(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return parts.length ? (parts[0][0] + (parts[1]?.[0] ?? '')).toUpperCase() : '?';
}

export default function LeaderboardScreen() {
  const theme = useTheme();
  const { user } = useAuth();
  const { ranked } = useRatings();
  const [scope, setScope] = useState<Scope>('global');
  const [metricKey, setMetricKey] = useState<MetricKey>('reviews');

  const metric = METRICS.find((m) => m.key === metricKey)!;
  const youId = user?.id ?? 'you';

  const rows = useMemo(() => {
    const you: LeaderboardUser = {
      id: youId,
      username: user?.displayName ?? 'You',
      initials: initialsFrom(user?.displayName ?? 'You'),
      isFriend: true,
      reviews: ranked.length,
      concerts: PROFILE.shows,
      streak: PROFILE.streak,
    };
    const pool = scope === 'friends' ? LEADERBOARD_USERS.filter((u) => u.isFriend) : LEADERBOARD_USERS;
    return [...pool, you].sort((a, b) => metric.get(b) - metric.get(a));
  }, [scope, metric, ranked.length, user, youId]);

  return (
    <ThemedView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <Segmented
          options={[
            { key: 'global', label: 'Global' },
            { key: 'friends', label: 'Friends' },
          ]}
          value={scope}
          onChange={(v) => setScope(v as Scope)}
          testIDPrefix="scope"
          style={{ marginBottom: Spacing.one }}
        />

        <View style={styles.chips}>
          {METRICS.map((m) => {
            const active = m.key === metricKey;
            return (
              <Pressable
                key={m.key}
                testID={`metric-${m.key}`}
                onPress={() => setMetricKey(m.key)}
                style={[
                  styles.chip,
                  { backgroundColor: active ? '#1D9E75' : theme.backgroundElement },
                ]}>
                <ThemedText type="small" style={{ color: active ? '#fff' : theme.textSecondary }}>
                  {m.label}
                </ThemedText>
              </Pressable>
            );
          })}
        </View>

        {rows.map((u, i) => {
          const isYou = u.id === youId;
          return (
            <View
              key={u.id}
              style={[
                styles.row,
                {
                  backgroundColor: isYou ? '#1D9E7522' : theme.backgroundElement,
                  borderColor: isYou ? '#1D9E75' : 'transparent',
                },
              ]}>
              <ThemedText
                type="smallBold"
                style={[styles.rank, { color: MEDALS[i] ?? theme.textSecondary }]}>
                {i + 1}
              </ThemedText>
              <View style={[styles.avatar, { backgroundColor: theme.backgroundSelected }]}>
                <ThemedText type="smallBold">{u.initials}</ThemedText>
              </View>
              <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: Spacing.two }}>
                <ThemedText type="smallBold" numberOfLines={1}>
                  {u.username}
                </ThemedText>
                {isYou && (
                  <View style={styles.youBadge}>
                    <ThemedText type="small" style={{ color: '#1D9E75', fontSize: 11 }}>
                      you
                    </ThemedText>
                  </View>
                )}
              </View>
              <ThemedText type="smallBold">{metric.format(metric.get(u))}</ThemedText>
            </View>
          );
        })}

        <ThemedText type="small" themeColor="textSecondary" style={styles.footnote}>
          Ranked by {metric.label.toLowerCase()} ·{' '}
          {scope === 'friends' ? 'people you follow' : 'everyone on Heard'}
        </ThemedText>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { padding: Spacing.three, gap: Spacing.two },
  chips: { flexDirection: 'row', gap: Spacing.two, marginBottom: Spacing.two },
  chip: { paddingVertical: 6, paddingHorizontal: Spacing.three, borderRadius: 999 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    padding: Spacing.three,
    borderRadius: 12,
    borderWidth: 1,
  },
  rank: { width: 22, textAlign: 'center', fontSize: 16 },
  avatar: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  youBadge: {
    backgroundColor: '#1D9E7522',
    borderRadius: 999,
    paddingHorizontal: Spacing.two,
    paddingVertical: 1,
  },
  footnote: { textAlign: 'center', marginTop: Spacing.two },
});
