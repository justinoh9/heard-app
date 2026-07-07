/**
 * Pure leaderboard logic: turn raw per-user counts into a scoped, ranked board.
 * Kept free of React/Supabase (relative imports only) so it runs under the tsx
 * node test runner, the same split as src/data/ratings-rows.ts and
 * src/social/feed-rows.ts.
 *
 * The three metrics are all real aggregates over cloud tables — ratings,
 * concerts, comments. There is deliberately no streak metric: streaks live in
 * device-local AsyncStorage (by design), so they can't be aggregated across
 * users, and showing a fabricated number would violate ROADMAP goal #4.
 *
 * Extensible by design: to add a metric, give LeaderboardEntry the field and
 * add one entry to METRICS — the scope toggle and screen pick it up.
 */

import type { LeaderboardEntry } from '../social/types';

import { LEADERBOARD_USERS } from './data';

export type Scope = 'friends' | 'global';

export type MetricKey = 'rated' | 'shows' | 'reviews';

export interface LeaderboardMetric {
  key: MetricKey;
  label: string;
  get: (e: LeaderboardEntry) => number;
}

export const METRICS: LeaderboardMetric[] = [
  { key: 'rated', label: 'Rated', get: (e) => e.rated },
  { key: 'shows', label: 'Shows', get: (e) => e.shows },
  { key: 'reviews', label: 'Reviews', get: (e) => e.reviews },
];

/** Minimal profile shape the tally needs — the roster of real users. */
export interface LeaderboardProfile {
  userId: string;
  displayName: string;
}

/** Tally a flat list of user ids into per-id counts. */
function countBy(userIds: string[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const id of userIds) counts.set(id, (counts.get(id) ?? 0) + 1);
  return counts;
}

/**
 * Join the profile roster with three flat arrays of author user ids (one per
 * ratings / concerts / comments row) into aggregate entries. Users without a
 * profile row (e.g. orphaned rows from an earlier auth id) are excluded — the
 * board only ranks real, named profiles.
 */
export function tallyLeaderboard(
  profiles: LeaderboardProfile[],
  ratedUserIds: string[],
  showUserIds: string[],
  reviewUserIds: string[],
): LeaderboardEntry[] {
  const rated = countBy(ratedUserIds);
  const shows = countBy(showUserIds);
  const reviews = countBy(reviewUserIds);
  return profiles.map((p) => ({
    userId: p.userId,
    displayName: p.displayName,
    rated: rated.get(p.userId) ?? 0,
    shows: shows.get(p.userId) ?? 0,
    reviews: reviews.get(p.userId) ?? 0,
  }));
}

/**
 * Replace (or insert) the viewer's entry so their live client counts win over
 * the possibly-stale server aggregate — the same optimism the rest of the app
 * uses. Guarantees the viewer always appears on the board.
 */
export function mergeCurrentUser(
  entries: LeaderboardEntry[],
  current: LeaderboardEntry | null,
): LeaderboardEntry[] {
  if (!current) return entries;
  const rest = entries.filter((e) => e.userId !== current.userId);
  return [...rest, current];
}

/**
 * Scope-filter and sort a board, descending by the chosen metric. Ties break on
 * display name so medal order is deterministic across renders. Never mutates the
 * input. 'friends' scope keeps the viewer plus everyone they follow.
 */
export function rankBoard(
  entries: LeaderboardEntry[],
  opts: {
    scope: Scope;
    followingIds: Set<string>;
    currentUserId: string | null;
    metric: LeaderboardMetric;
  },
): LeaderboardEntry[] {
  const { scope, followingIds, currentUserId, metric } = opts;
  const scoped =
    scope === 'global'
      ? entries
      : entries.filter((e) => e.userId === currentUserId || followingIds.has(e.userId));
  return [...scoped].sort((a, b) => {
    const byMetric = metric.get(b) - metric.get(a);
    if (byMetric !== 0) return byMetric;
    return a.displayName.localeCompare(b.displayName);
  });
}

/**
 * Clearly-demo filler for the zero-config (no-Supabase) local mode ONLY — never
 * shown to real cloud users. Reuses the mock roster (src/leaderboard/data.ts) so
 * the Ranks tab isn't empty in a backend-free demo. Streak is dropped; the old
 * review/concert counts stand in for rated/shows.
 */
export function demoEntries(): LeaderboardEntry[] {
  return LEADERBOARD_USERS.map((u) => ({
    userId: u.id,
    displayName: u.username,
    rated: u.reviews,
    shows: u.concerts,
    reviews: Math.round(u.reviews * 0.35),
  }));
}
