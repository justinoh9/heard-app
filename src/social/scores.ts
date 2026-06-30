/**
 * Per-item social score breakdown: your score vs your friends' vs the global
 * average. Mock for now — there's no backend holding real friend ratings yet
 * (SPEC §7) — but the numbers are *deterministic per item*, derived from a hash
 * of the item id, so the same album always shows the same breakdown across
 * renders and screens instead of flickering random values.
 *
 * Imports are relative (not the `@/` alias) so this stays runnable under the
 * `tsx` node test runner, like the ranking/music suites.
 */

import { LEADERBOARD_USERS } from '../leaderboard/data';
import { snapScore } from '../ranking/score';

export interface FriendScore {
  id: string;
  username: string;
  initials: string;
  score: number;
}

export interface ScoreBreakdown {
  /** The current user's own score, if they've rated this item. */
  you?: number;
  /** Friends who have rated this item (deterministic subset). */
  friends: FriendScore[];
  /** Mean of `friends`, or undefined when none have rated it. */
  friendsAvg?: number;
  /** Mock global community average. */
  globalAvg: number;
  /** Mock count of global ratings, for the "N ratings" caption. */
  globalCount: number;
}

const FRIENDS = LEADERBOARD_USERS.filter((u) => u.isFriend);

/** FNV-1a hash → uint32. Stable across runs so a given seed always maps the same. */
function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** mulberry32 PRNG: seed → deterministic stream of floats in [0, 1). */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Most listeners who bother to rate land in the upper-middle band, ~6.5–9.5. */
function pleasantScore(r: number): number {
  return snapScore(6.5 + r * 3);
}

/** Friends who have rated this item, with their (mock) scores. Deterministic. */
export function friendScoresFor(itemId: string): FriendScore[] {
  const out: FriendScore[] = [];
  for (const f of FRIENDS) {
    const rnd = mulberry32(hashString(`${itemId}:${f.id}`));
    // First draw decides participation (~30% of friends haven't rated it).
    if (rnd() < 0.3) continue;
    out.push({ id: f.id, username: f.username, initials: f.initials, score: pleasantScore(rnd()) });
  }
  return out;
}

/** Mock global average + rating count for an item. Deterministic. */
export function globalStatsFor(itemId: string): { avg: number; count: number } {
  const rnd = mulberry32(hashString(`${itemId}:global`));
  const avg = snapScore(6 + rnd() * 2.8); // 6.0–8.8
  const count = 200 + Math.floor(rnd() * 9800); // 200–10,000
  return { avg, count };
}

/** Assemble the full breakdown for an item, given the user's own score (if any). */
export function scoreBreakdown(itemId: string, you?: number): ScoreBreakdown {
  const friends = friendScoresFor(itemId);
  const friendsAvg = friends.length
    ? snapScore(friends.reduce((sum, f) => sum + f.score, 0) / friends.length)
    : undefined;
  const { avg, count } = globalStatsFor(itemId);
  return { you, friends, friendsAvg, globalAvg: avg, globalCount: count };
}

/** Compact count label, e.g. 1290 → "1.3k", 9800 → "9.8k". */
export function formatCount(n: number): string {
  if (n < 1000) return String(n);
  return `${(n / 1000).toFixed(1).replace(/\.0$/, '')}k`;
}
