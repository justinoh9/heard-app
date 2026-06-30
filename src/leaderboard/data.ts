/**
 * Leaderboard data + metrics. Ranks accounts by a chosen metric within a scope
 * (friends or global). Mock for now — Supabase provides real users/friends and
 * aggregate counts later (SPEC §7); the screen-facing shape stays the same.
 *
 * Extensible by design: to add a sortable metric, give every user the field and
 * add one entry to METRICS. The scope toggle and UI pick it up automatically.
 */

export interface LeaderboardUser {
  id: string;
  username: string;
  initials: string;
  isFriend: boolean;
  reviews: number;
  concerts: number;
  streak: number;
}

export type MetricKey = 'reviews' | 'concerts' | 'streak';

export interface LeaderboardMetric {
  key: MetricKey;
  label: string;
  get: (u: LeaderboardUser) => number;
  format: (n: number) => string;
}

export const METRICS: LeaderboardMetric[] = [
  { key: 'reviews', label: 'Reviews', get: (u) => u.reviews, format: (n) => String(n) },
  { key: 'concerts', label: 'Concerts', get: (u) => u.concerts, format: (n) => String(n) },
  { key: 'streak', label: 'Streak', get: (u) => u.streak, format: (n) => `${n}🔥` },
];

/** Everyone except the current user (who is injected live from their ratings). */
export const LEADERBOARD_USERS: LeaderboardUser[] = [
  // Friends (also appear in the feed).
  { id: 'u-bbq', username: 'bbq', initials: 'B', isFriend: true, reviews: 203, concerts: 5, streak: 12 },
  { id: 'u-maya', username: 'maya', initials: 'M', isFriend: true, reviews: 142, concerts: 9, streak: 50 },
  { id: 'u-devon', username: 'devon', initials: 'D', isFriend: true, reviews: 88, concerts: 21, streak: 30 },
  { id: 'u-kai', username: 'kai', initials: 'K', isFriend: true, reviews: 41, concerts: 2, streak: 8 },
  // Global (not friends).
  { id: 'u-archivist', username: 'the_archivist', initials: 'T', isFriend: false, reviews: 1290, concerts: 60, streak: 365 },
  { id: 'u-vinylvex', username: 'vinylvex', initials: 'V', isFriend: false, reviews: 540, concerts: 33, streak: 121 },
  { id: 'u-lola', username: 'lola.fm', initials: 'L', isFriend: false, reviews: 410, concerts: 18, streak: 204 },
  { id: 'u-pitchfork', username: 'ratecore', initials: 'R', isFriend: false, reviews: 305, concerts: 11, streak: 77 },
];
