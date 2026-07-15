import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { useAuth } from '@/auth/store';
import { EmptyState } from '@/components/empty-state';
import { GuestGate } from '@/components/guest-gate';
import { PageContainer } from '@/components/page-container';
import { Surface } from '@/components/surface';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useToast } from '@/components/toast';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import {
  countByStatus,
  groupReports,
  isRemovableTarget,
  REASON_LABELS,
  STATUS_LABELS,
  TARGET_LABELS,
  type ReportGroup,
} from '@/moderation/admin-rows';
import { moderationBackend } from '@/moderation/provider';
import { useModeration } from '@/moderation/store';
import type { AdminReport, ReportStatus } from '@/moderation/types';

/**
 * Report triage (ROADMAP Phase 4), reached from Settings → PRIVACY & SAFETY when
 * the viewer is an admin. 0019 shipped reporting with the note that reports would
 * be "triaged by hand in the SQL editor for now"; this is that "for now" ending.
 *
 * The `isAdmin` gate here is a courtesy, not a lock. Every row this screen can
 * show is scoped by RLS (0023) — a non-admin who forced their way to this route
 * would load an empty list and be unable to resolve anything. That's the intended
 * design: the client is never the thing standing between someone and the data.
 */

const FILTERS: { key: ReportStatus | 'all'; label: string }[] = [
  { key: 'open', label: 'Open' },
  { key: 'all', label: 'All' },
  { key: 'actioned', label: 'Actioned' },
  { key: 'dismissed', label: 'Dismissed' },
];

export default function AdminReportsScreen() {
  const theme = useTheme();
  const router = useRouter();
  const toast = useToast();
  const { status } = useAuth();
  const { isAdmin } = useModeration();

  const [reports, setReports] = useState<AdminReport[] | null>(null);
  const [filter, setFilter] = useState<ReportStatus | 'all'>('open');
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(() => {
    let cancelled = false;
    moderationBackend
      .listReports()
      .then((rs) => {
        if (!cancelled) setReports(rs);
      })
      .catch((e: unknown) => {
        console.warn('[admin/reports] load failed:', e);
        if (!cancelled) setReports([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => load(), [load]);

  const counts = useMemo(() => countByStatus(reports ?? []), [reports]);
  const groups = useMemo(() => {
    const list = reports ?? [];
    const scoped = filter === 'all' ? list : list.filter((r) => r.status === filter);
    return groupReports(scoped);
  }, [reports, filter]);

  /** Apply a decision to every report in the group — one target, one call. */
  const resolveGroup = useCallback(
    async (group: ReportGroup, next: ReportStatus, alsoDelete: boolean) => {
      setBusy(group.key);
      try {
        if (alsoDelete) {
          await moderationBackend.deleteReportedContent(group.targetType, group.targetId);
        }
        // Sequential rather than Promise.all: the reports rate limiter is per
        // statement, and a group is rarely more than a handful.
        for (const r of group.reports) {
          if (r.status !== next) await moderationBackend.setReportStatus(r.id, next);
        }
        setReports((prev) =>
          (prev ?? []).map((r) =>
            group.reports.some((g) => g.id === r.id) ? { ...r, status: next } : r,
          ),
        );
        toast(alsoDelete ? 'Removed and actioned' : `Marked ${STATUS_LABELS[next].toLowerCase()}`, '✓');
      } catch (e: unknown) {
        console.warn('[admin/reports] resolve failed:', e);
        toast(e instanceof Error ? e.message : 'Could not update that report', '⚠️');
      } finally {
        setBusy(null);
      }
    },
    [toast],
  );

  if (status !== 'authed') {
    return <GuestGate icon="flag-outline" title="Reports" message="Sign in to review reports." />;
  }

  if (!isAdmin) {
    return (
      <ThemedView style={styles.screen}>
        <TopBar title="Reports" onBack={() => router.back()} />
        <PageContainer style={styles.inner}>
          <EmptyState
            icon="lock-closed-outline"
            message="This is the moderation queue. Your account doesn't have review access."
          />
        </PageContainer>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.screen}>
      <TopBar title="Reports" onBack={() => router.back()} />
      <ScrollView contentContainerStyle={styles.content}>
        <PageContainer style={styles.inner}>
          <ThemedText type="small" themeColor="textSecondary">
            {counts.open === 0
              ? 'Nothing waiting. Reports appear here the moment someone files one.'
              : `${counts.open} report${counts.open === 1 ? '' : 's'} waiting on a decision.`}
          </ThemedText>

          <View style={styles.filters}>
            {FILTERS.map((f) => {
              const active = filter === f.key;
              const n = f.key === 'all' ? (reports ?? []).length : counts[f.key];
              return (
                <Pressable
                  key={f.key}
                  onPress={() => setFilter(f.key)}
                  accessibilityRole="button"
                  accessibilityLabel={`Show ${f.label} reports`}
                  style={[
                    styles.chip,
                    {
                      borderColor: active ? theme.accent : theme.textSecondary,
                      backgroundColor: active ? theme.accentSoft : 'transparent',
                    },
                  ]}>
                  <ThemedText type="smallBold" themeColor={active ? 'accent' : 'textSecondary'}>
                    {f.label} {n > 0 ? `· ${n}` : ''}
                  </ThemedText>
                </Pressable>
              );
            })}
          </View>

          {reports === null ? (
            <ActivityIndicator color={theme.accent} />
          ) : groups.length === 0 ? (
            <EmptyState
              icon="shield-checkmark-outline"
              message={
                filter === 'open'
                  ? 'The queue is empty. Nothing needs a decision right now.'
                  : 'No reports match this filter.'
              }
            />
          ) : (
            groups.map((g) => (
              <ReportGroupCard
                key={g.key}
                group={g}
                busy={busy === g.key}
                onResolve={resolveGroup}
              />
            ))
          )}
        </PageContainer>
      </ScrollView>
    </ThemedView>
  );
}

function ReportGroupCard({
  group,
  busy,
  onResolve,
}: {
  group: ReportGroup;
  busy: boolean;
  onResolve: (g: ReportGroup, next: ReportStatus, alsoDelete: boolean) => void;
}) {
  const theme = useTheme();
  const router = useRouter();
  const removable = isRemovableTarget(group.targetType);
  const newest = group.reports[0];

  return (
    <Surface style={styles.card}>
      <View style={styles.cardHead}>
        <View style={styles.badge}>
          <ThemedText type="smallBold" themeColor="textSecondary">
            {TARGET_LABELS[group.targetType]}
          </ThemedText>
        </View>
        {group.hasOpen ? (
          <View style={[styles.badge, { backgroundColor: theme.accentSoft }]}>
            <ThemedText type="smallBold" themeColor="accent">
              Needs review
            </ThemedText>
          </View>
        ) : (
          <ThemedText type="small" themeColor="textSecondary">
            {STATUS_LABELS[newest.status]}
          </ThemedText>
        )}
      </View>

      <ThemedText type="smallBold">
        {group.reports.length === 1
          ? REASON_LABELS[newest.reason]
          : `${group.reports.length} reports · ${REASON_LABELS[newest.reason]}`}
      </ThemedText>

      {group.reports.some((r) => r.note) ? (
        <View style={styles.notes}>
          {group.reports
            .filter((r) => r.note)
            .map((r) => (
              <ThemedText key={r.id} type="small" themeColor="textSecondary">
                “{r.note}”
              </ThemedText>
            ))}
        </View>
      ) : null}

      {group.targetUserId ? (
        <Pressable
          onPress={() => router.push(`/user/${group.targetUserId}`)}
          accessibilityRole="button"
          accessibilityLabel="Open the reported account">
          <ThemedText type="linkPrimary">View reported account</ThemedText>
        </Pressable>
      ) : null}

      {busy ? (
        <ActivityIndicator color={theme.accent} />
      ) : (
        <View style={styles.actions}>
          {removable ? (
            <Action
              label="Remove"
              tone={theme.danger}
              onPress={() => onResolve(group, 'actioned', true)}
            />
          ) : null}
          <Action label="Dismiss" onPress={() => onResolve(group, 'dismissed', false)} />
          {group.hasOpen ? (
            <Action label="Mark reviewed" onPress={() => onResolve(group, 'reviewed', false)} />
          ) : (
            <Action label="Reopen" onPress={() => onResolve(group, 'open', false)} />
          )}
        </View>
      )}
    </Surface>
  );
}

function Action({ label, onPress, tone }: { label: string; onPress: () => void; tone?: string }) {
  const theme = useTheme();
  const color = tone ?? theme.textSecondary;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [styles.action, { borderColor: color, opacity: pressed ? 0.6 : 1 }]}>
      <ThemedText type="smallBold" style={{ color }}>
        {label}
      </ThemedText>
    </Pressable>
  );
}

function TopBar({ title, onBack }: { title: string; onBack: () => void }) {
  const theme = useTheme();
  return (
    <View style={styles.topBar}>
      <Pressable onPress={onBack} accessibilityLabel="Back" hitSlop={8}>
        <Ionicons name="chevron-back" size={26} color={theme.text} />
      </Pressable>
      <ThemedText type="smallBold">{title}</ThemedText>
      <View style={{ width: 26 }} />
    </View>
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
  filters: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  chip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: Spacing.three,
    paddingVertical: 6,
  },
  card: { gap: Spacing.two },
  cardHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  badge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2 },
  notes: { gap: 4 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  action: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: Spacing.three,
    paddingVertical: 6,
  },
});
