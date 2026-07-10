import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { EmptyState } from '@/components/empty-state';
import { PageContainer } from '@/components/page-container';
import { QuickMatchCard } from '@/components/quick-match-card';
import { Segmented } from '@/components/segmented';
import { Surface } from '@/components/surface';
import { useConcerts } from '@/concerts/store';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useAuth } from '@/auth/store';
import { useRatings } from '@/data/store';
import { useResponsive } from '@/hooks/use-responsive';
import { useTheme } from '@/hooks/use-theme';
import { METRICS, mergeCurrentUser, rankBoard, type MetricKey, type Scope } from '@/leaderboard/rank';
import { initialsOf } from '@/social/feed-rows';
import { socialBackend } from '@/social/provider';
import { useSocial } from '@/social/store';
import type { LeaderboardEntry } from '@/social/types';

const MEDALS = ['#EFA72A', '#9AA0A6', '#C77B3B']; // gold, silver, bronze

export default function LeaderboardScreen() {
  const theme = useTheme();
  const { isWide } = useResponsive();
  const { user } = useAuth();
  const { ranked } = useRatings();
  const { concerts } = useConcerts();
  const { followingIds } = useSocial();
  const [scope, setScope] = useState<Scope>('global');
  const [metricKey, setMetricKey] = useState<MetricKey>('rated');

  // Real per-user aggregates, loaded once behind the SocialBackend seam.
  const [entries, setEntries] = useState<LeaderboardEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setEntries(null);
    setError(null);
    socialBackend
      .leaderboard()
      .then(setEntries)
      .catch((e: unknown) => {
        console.warn('[leaderboard] load failed:', e);
        setError('Could not load the leaderboard.');
      });
  }, []);

  useEffect(load, [load]);

  const metric = METRICS.find((m) => m.key === metricKey)!;
  const youId = user?.id ?? null;

  const rows = useMemo(() => {
    if (!entries) return [];
    // The viewer's live client counts (rated/shows) win over the possibly-stale
    // server aggregate; their comment count comes from the server row (no live
    // client count for it). Guests have no entry to inject.
    const backendMe = youId ? entries.find((e) => e.userId === youId) : undefined;
    const current: LeaderboardEntry | null =
      user && youId
        ? {
            userId: youId,
            displayName: user.displayName || 'You',
            rated: ranked.length,
            shows: concerts.length,
            reviews: backendMe?.reviews ?? 0,
          }
        : null;
    const merged = mergeCurrentUser(entries, current);
    return rankBoard(merged, { scope, followingIds, currentUserId: youId, metric });
  }, [entries, scope, metric, ranked.length, concerts.length, user, youId, followingIds]);

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
            {METRICS.map((m) => {
              const active = m.key === metricKey;
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

          {entries === null && !error && <ActivityIndicator style={{ marginTop: Spacing.four }} />}

          {error && (
            <ThemedText type="small" style={{ color: theme.danger, marginTop: Spacing.two }}>
              {error}
            </ThemedText>
          )}

          {entries !== null && !error && rows.length === 0 && (
            <EmptyState
              icon="trophy-outline"
              message={
                scope === 'friends'
                  ? 'Follow people to see how you stack up.'
                  : 'No one on the board yet — rate something to get started.'
              }
            />
          )}

          {rows.map((u, i) => {
            const isYou = u.userId === youId;
            return (
              <Surface
                key={u.userId}
                style={styles.row}
                background={isYou ? theme.accentSoft : undefined}>
                <ThemedText
                  type="smallBold"
                  style={[styles.rank, { color: MEDALS[i] ?? theme.textSecondary }]}>
                  {i + 1}
                </ThemedText>
                <View style={[styles.avatar, { backgroundColor: theme.backgroundSelected }]}>
                  <ThemedText type="smallBold">{initialsOf(u.displayName)}</ThemedText>
                </View>
                <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: Spacing.two }}>
                  <ThemedText type="smallBold" numberOfLines={1}>
                    {u.displayName}
                  </ThemedText>
                  {isYou && (
                    <View style={[styles.youBadge, { backgroundColor: theme.accentSoft }]}>
                      <ThemedText type="small" style={{ color: theme.accent, fontSize: 11 }}>
                        you
                      </ThemedText>
                    </View>
                  )}
                </View>
                <ThemedText type="smallBold">{metric.get(u)}</ThemedText>
              </Surface>
            );
          })}

          {rows.length > 0 && (
            <ThemedText type="small" themeColor="textSecondary" style={styles.footnote}>
              Ranked by {metric.label.toLowerCase()} ·{' '}
              {scope === 'friends' ? 'people you follow' : 'everyone on Jelli'}
            </ThemedText>
          )}
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
  row: { flexDirection: 'row', alignItems: 'center' },
  rank: { width: 22, textAlign: 'center', fontSize: 16 },
  avatar: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  youBadge: {
    borderRadius: 999,
    paddingHorizontal: Spacing.two,
    paddingVertical: 1,
  },
  footnote: { textAlign: 'center', marginTop: Spacing.two },
});
