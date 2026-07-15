import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { analyticsBackend } from '@/analytics/provider';
import type { FunnelCounts } from '@/analytics/types';
import { useAuth } from '@/auth/store';
import { EmptyState } from '@/components/empty-state';
import { GuestGate } from '@/components/guest-gate';
import { PageContainer } from '@/components/page-container';
import { Surface } from '@/components/surface';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useModeration } from '@/moderation/store';

/**
 * The funnel (ROADMAP Phase 4), reached from Settings → PRIVACY & SAFETY for
 * admins. Four numbers, cohorted by sign-up date: of the people who joined in
 * this window, how many did the thing.
 *
 * Cohorting is the whole point. Counting all-time sign-ups against this week's
 * activity produces a chart that always slopes down and never means anything.
 *
 * Like the reports queue, the gate here is a courtesy: `analytics_funnel` checks
 * `is_admin()` inside the function (0027), so forcing this route as a normal user
 * loads nothing.
 */

const WINDOWS = [
  { days: 7, label: '7 days' },
  { days: 30, label: '30 days' },
  { days: 90, label: '90 days' },
];

export default function AdminAnalyticsScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { status } = useAuth();
  const { isAdmin } = useModeration();

  const [days, setDays] = useState(30);
  const [counts, setCounts] = useState<FunnelCounts | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    let cancelled = false;
    setLoading(true);
    analyticsBackend
      .funnel(days)
      .then((c) => {
        if (!cancelled) setCounts(c);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [days]);

  useEffect(() => load(), [load]);

  if (status !== 'authed') {
    return <GuestGate icon="stats-chart-outline" title="Funnel" message="Sign in to view the funnel." />;
  }

  return (
    <ThemedView style={styles.screen}>
      <View style={styles.topBar}>
        <Pressable
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/settings'))}
          accessibilityLabel="Back"
          hitSlop={8}>
          <Ionicons name="chevron-back" size={26} color={theme.text} />
        </Pressable>
        <ThemedText type="smallBold">Funnel</ThemedText>
        <View style={{ width: 26 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <PageContainer style={styles.inner}>
          {!isAdmin ? (
            <EmptyState
              icon="lock-closed-outline"
              message="Your account doesn't have access to the funnel."
            />
          ) : (
            <>
              <View style={styles.filters}>
                {WINDOWS.map((w) => {
                  const active = days === w.days;
                  return (
                    <Pressable
                      key={w.days}
                      onPress={() => setDays(w.days)}
                      accessibilityRole="button"
                      accessibilityLabel={`Show the last ${w.label}`}
                      style={[
                        styles.chip,
                        {
                          borderColor: active ? theme.accent : theme.textSecondary,
                          backgroundColor: active ? theme.accentSoft : 'transparent',
                        },
                      ]}>
                      <ThemedText type="smallBold" themeColor={active ? 'accent' : 'textSecondary'}>
                        {w.label}
                      </ThemedText>
                    </Pressable>
                  );
                })}
              </View>

              <ThemedText type="small" themeColor="textSecondary">
                Of the people who signed up in the last {days} days.
              </ThemedText>

              {loading ? (
                <ActivityIndicator color={theme.accent} />
              ) : !counts ? (
                <EmptyState
                  icon="cloud-offline-outline"
                  message="Couldn't load the funnel. If you just added analytics, make sure migration 0027 has run."
                />
              ) : counts.signedUp === 0 ? (
                <EmptyState
                  icon="stats-chart-outline"
                  message={`Nobody signed up in the last ${days} days, so there's no funnel to draw yet.`}
                />
              ) : (
                <>
                  <Step label="Signed up" value={counts.signedUp} of={counts.signedUp} theme={theme} />
                  <Step
                    label="Rated something"
                    value={counts.activated}
                    of={counts.signedUp}
                    theme={theme}
                    note="Activation — the moment the app has a reason to exist for them."
                  />
                  <Step
                    label="Followed someone"
                    value={counts.connected}
                    of={counts.signedUp}
                    theme={theme}
                    note="The feed is empty until this happens."
                  />
                  <Step
                    label="Came back after a week"
                    value={counts.retainedD7}
                    of={counts.signedUp}
                    theme={theme}
                    note="D7 return. The number that decides whether any of the rest matters."
                  />
                </>
              )}
            </>
          )}
        </PageContainer>
      </ScrollView>
    </ThemedView>
  );
}

function Step({
  label,
  value,
  of,
  theme,
  note,
}: {
  label: string;
  value: number;
  of: number;
  theme: ReturnType<typeof useTheme>;
  note?: string;
}) {
  // `of` is the cohort size and is never 0 here (the caller renders an empty
  // state first), but guard anyway — a divide-by-zero would render "NaN%" to the
  // one person who needs to trust these numbers.
  const pct = of > 0 ? Math.round((value / of) * 100) : 0;
  return (
    <Surface style={styles.step}>
      <View style={styles.stepHead}>
        <ThemedText type="smallBold">{label}</ThemedText>
        <ThemedText type="smallBold" themeColor="accent">
          {value} · {pct}%
        </ThemedText>
      </View>
      <View style={[styles.track, { backgroundColor: theme.backgroundSelected }]}>
        <View style={[styles.fill, { width: `${pct}%`, backgroundColor: theme.accent }]} />
      </View>
      {note ? (
        <ThemedText type="small" themeColor="textSecondary">
          {note}
        </ThemedText>
      ) : null}
    </Surface>
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
  content: { padding: Spacing.three, paddingBottom: Spacing.six },
  inner: { gap: Spacing.three },
  filters: { flexDirection: 'row', gap: Spacing.two },
  chip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: Spacing.three, paddingVertical: 6 },
  step: { gap: Spacing.two },
  stepHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  track: { height: 8, borderRadius: 999, overflow: 'hidden' },
  fill: { height: 8, borderRadius: 999 },
});
