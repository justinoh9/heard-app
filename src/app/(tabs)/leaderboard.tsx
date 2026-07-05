import { Ionicons } from '@expo/vector-icons';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { PageContainer } from '@/components/page-container';
import { QuickMatchCard } from '@/components/quick-match-card';
import { Segmented } from '@/components/segmented';
import { concertsBackend } from '@/concerts/provider';
import { useConcerts } from '@/concerts/store';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useAuth } from '@/auth/store';
import { ratingsBackend } from '@/data/ratings-provider';
import { useRatings } from '@/data/store';
import { useResponsive } from '@/hooks/use-responsive';
import { useTheme } from '@/hooks/use-theme';
import { LEADERBOARD_USERS, METRICS, type LeaderboardUser, type MetricKey } from '@/leaderboard/data';
import { useSocial } from '@/social/store';
import { useStreaks } from '@/streaks/store';

type Scope = 'friends' | 'global';

const MEDALS = ['#EFA72A', '#9AA0A6', '#C77B3B']; // gold, silver, bronze

function initialsFrom(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return parts.length ? (parts[0][0] + (parts[1]?.[0] ?? '')).toUpperCase() : '?';
}

export default function LeaderboardScreen() {
  const theme = useTheme();
  const { isWide } = useResponsive();
  const { user } = useAuth();
  const { ranked } = useRatings();
  const { concerts } = useConcerts();
  const { current: streak } = useStreaks();
  const { people, followingIds } = useSocial();
  const [scope, setScope] = useState<Scope>('global');
  const [metricKey, setMetricKey] = useState<MetricKey>('reviews');

  const followed = useMemo(
    () => people.filter((p) => followingIds.has(p.userId)),
    [people, followingIds],
  );
  const followedKey = followed.map((p) => p.userId).sort().join(',');

  // Real metrics for the people you follow (rating + concert counts), loaded
  // once per follow set. Streak isn't stored server-side, so it's dropped from
  // the friends board (see availableMetrics) rather than shown as a fake 0.
  const [friendStats, setFriendStats] = useState<Map<string, { reviews: number; concerts: number }>>(
    new Map(),
  );
  useEffect(() => {
    if (followed.length === 0) {
      setFriendStats(new Map());
      return;
    }
    let cancelled = false;
    Promise.all(
      followed.map(async (p) => {
        const [reviews, concertCount] = await Promise.all([
          ratingsBackend.load(p.userId).then((s) => s?.list.length ?? 0).catch(() => 0),
          concertsBackend.listFor(p.userId).then((l) => l.length).catch(() => 0),
        ]);
        return [p.userId, { reviews, concerts: concertCount }] as const;
      }),
    ).then((entries) => {
      if (!cancelled) setFriendStats(new Map(entries));
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [followedKey]);

  const availableMetrics = scope === 'friends' ? METRICS.filter((m) => m.key !== 'streak') : METRICS;
  const effectiveMetricKey: MetricKey = availableMetrics.some((m) => m.key === metricKey)
    ? metricKey
    : 'reviews';
  const metric = METRICS.find((m) => m.key === effectiveMetricKey)!;
  const youId = user?.id ?? 'you';

  const rows = useMemo(() => {
    const you: LeaderboardUser = {
      id: youId,
      username: user?.displayName ?? 'You',
      initials: initialsFrom(user?.displayName ?? 'You'),
      isFriend: true,
      reviews: ranked.length,
      concerts: concerts.length,
      streak,
    };
    const friends: LeaderboardUser[] = followed.map((p) => {
      const s = friendStats.get(p.userId);
      return {
        id: p.userId,
        username: p.displayName,
        initials: initialsFrom(p.displayName),
        isFriend: true,
        reviews: s?.reviews ?? 0,
        concerts: s?.concerts ?? 0,
        streak: 0,
      };
    });
    const pool = scope === 'friends' ? [...friends, you] : [...LEADERBOARD_USERS, you];
    return pool.sort((a, b) => metric.get(b) - metric.get(a));
  }, [scope, metric, ranked.length, user, youId, streak, concerts.length, followed, friendStats]);

  return (
    <ThemedView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <PageContainer style={styles.inner}>
          <QuickMatchCard />

          <Segmented
            options={[
              { key: 'global', label: 'Global' },
              { key: 'friends', label: 'Friends' },
            ]}
            value={scope}
            onChange={(v) => setScope(v as Scope)}
            testIDPrefix="scope"
            style={{ marginBottom: Spacing.one, ...(isWide && { alignSelf: 'flex-start' }) }}
          />

          <View style={styles.chips}>
            {availableMetrics.map((m) => {
              const active = m.key === effectiveMetricKey;
              return (
                <Pressable
                  key={m.key}
                  testID={`metric-${m.key}`}
                  onPress={() => setMetricKey(m.key)}
                  style={[
                    styles.chip,
                    { backgroundColor: active ? theme.accent : theme.backgroundElement },
                  ]}>
                  <ThemedText type="small" style={{ color: active ? theme.onAccent : theme.textSecondary }}>
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
                    backgroundColor: isYou ? theme.accentSoft : theme.backgroundElement,
                    borderColor: isYou ? theme.accent : 'transparent',
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
                    <View style={[styles.youBadge, { backgroundColor: theme.accentSoft }]}>
                      <ThemedText type="small" style={{ color: theme.accent, fontSize: 11 }}>
                        you
                      </ThemedText>
                    </View>
                  )}
                </View>
                <ThemedText type="smallBold">{metric.format(metric.get(u))}</ThemedText>
              </View>
            );
          })}

          {scope === 'friends' && followed.length === 0 && (
            <ThemedText type="small" themeColor="textSecondary" style={styles.footnote}>
              Follow people to see them ranked here.
            </ThemedText>
          )}

          <ThemedText type="small" themeColor="textSecondary" style={styles.footnote}>
            Ranked by {metric.label.toLowerCase()} ·{' '}
            {scope === 'friends' ? 'people you follow' : 'everyone on Heard'}
          </ThemedText>
        </PageContainer>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { padding: Spacing.three },
  inner: { gap: Spacing.two },
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
    borderRadius: 999,
    paddingHorizontal: Spacing.two,
    paddingVertical: 1,
  },
  footnote: { textAlign: 'center', marginTop: Spacing.two },
});
