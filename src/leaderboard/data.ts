/**
 * Mock leaderboard roster — DEMO DATA ONLY, no longer the Ranks tab's source.
 *
 * The live leaderboard now aggregates real cloud data (see
 * src/leaderboard/rank.ts + SocialBackend.leaderboard). This roster survives in
 * two narrow demo roles:
 *   1. the comments "friends" filter (src/comments/filter.ts), still mock until
 *      that filter is wired to the real follow graph (ROADMAP Phase 1, Feed v2);
 *   2. clearly-demo filler for the zero-config (no-Supabase) local mode, via
 *      `demoEntries()` in rank.ts.
 * Real cloud users never see these numbers.
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
