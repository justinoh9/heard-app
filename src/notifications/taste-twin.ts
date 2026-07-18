/**
 * The taste-twin notification source (ROADMAP G3 follow-up): "your taste twin
 * rated X". Derived at read time like every other source — no table, no write
 * hooks — from data the recommendations seam already fetches: the followed
 * friends' ranked lists (now carrying `ratedAt`) scored with
 * social/compatibility.
 *
 * Pure and framework-free so it runs under the tsx node test runner; the
 * notifications store owns the fetching and feeds this fold.
 */

import type { FriendRating } from '@/recommendations/types';

import type { AppNotification } from './types';

/** A followed friend, scored against the viewer — recommend.ts's shape + ratedAt. */
export interface TwinFriend {
  userId: string;
  userName: string;
  /** 0–100 taste match with the viewer (from social/compatibility). */
  compatibility: number;
  ratings: FriendRating[];
}

/** Below this match, "taste twin" would be a lie — better no notification. */
export const TWIN_MIN_COMPATIBILITY = 50;
/** How recent a twin's rating must be to ping. */
export const TWIN_WINDOW_DAYS = 14;
/** The "they loved it" bar — same floor as the For-you recommender. */
export const TWIN_MIN_SCORE = 8;
/** Cap so the twin can't crowd the feed after a logging spree. */
export const TWIN_LIMIT = 3;

/**
 * The viewer's taste twin: their most-compatible followed friend, if the match
 * clears the floor. Ties break by name then id so the pick is stable.
 */
export function tasteTwin(
  friends: TwinFriend[],
  minCompatibility = TWIN_MIN_COMPATIBILITY,
): TwinFriend | null {
  return (
    friends
      .filter((f) => f.compatibility >= minCompatibility)
      .sort(
        (a, b) =>
          b.compatibility - a.compatibility ||
          a.userName.localeCompare(b.userName) ||
          a.userId.localeCompare(b.userId),
      )[0] ?? null
  );
}

/**
 * Notifications for the twin's recent high ratings on music the viewer hasn't
 * logged, newest first. Ratings without a `ratedAt` (local snapshots) can't
 * prove recency, so they never ping.
 *
 * Known limit: `createdAt` is the rating time, so following a NEW twin whose
 * qualifying ratings predate your last bell visit surfaces them already-read
 * (in the list, no badge). Unlike the queue trigger there's no timestamp for
 * "when this person became your twin" to clamp against; the common case — an
 * established twin rates something new — lights the bell correctly.
 */
export function tasteTwinNotifications(
  friends: TwinFriend[],
  viewerRatedIds: Set<string>,
  now: Date,
  opts: { minCompatibility?: number; windowDays?: number; minScore?: number; limit?: number } = {},
): AppNotification[] {
  const twin = tasteTwin(friends, opts.minCompatibility);
  if (!twin) return [];

  const windowDays = opts.windowDays ?? TWIN_WINDOW_DAYS;
  const minScore = opts.minScore ?? TWIN_MIN_SCORE;
  const cutoff = now.getTime() - windowDays * 24 * 60 * 60 * 1000;

  return twin.ratings
    .filter((r) => {
      if (r.score < minScore || viewerRatedIds.has(r.item.id)) return false;
      if (r.item.type === 'artist') return false; // item pages are songs/albums
      const t = r.ratedAt ? Date.parse(r.ratedAt) : NaN;
      return Number.isFinite(t) && t >= cutoff;
    })
    .sort((a, b) => (b.ratedAt ?? '').localeCompare(a.ratedAt ?? ''))
    .slice(0, opts.limit ?? TWIN_LIMIT)
    .map((r) => ({
      id: `twin-${twin.userId}-${r.item.id}`,
      kind: 'twin' as const,
      actorId: twin.userId,
      actorName: twin.userName,
      createdAt: r.ratedAt as string,
      subject: r.item.title,
      excerpt: `${r.score.toFixed(1)} from your taste twin · ${twin.compatibility}% match`,
      itemId: r.item.id,
      itemType: r.item.type === 'song' ? ('song' as const) : ('album' as const),
    }));
}
