/**
 * The queue trigger (Growth playbook: Triggers + Practical Value; the G1
 * follow-up "3 things on your list were just rated by friends"): when a friend
 * rates something sitting on your want-to-listen list, that's the single most
 * actionable ping this app can send — you already said you want to hear it,
 * and now someone you follow has an opinion about it.
 *
 * Derived at read time like every other notification source, from data the
 * store already holds: the queue items and the friends' rating lists (with
 * `ratedAt`) that the taste-twin source fetches. Pure and framework-free so it
 * runs under the tsx node test runner.
 */

import type { FriendRating } from '@/recommendations/types';

import type { AppNotification } from './types';

/** A followed friend and their ratings — same shape the twin source uses. */
export interface QueueTriggerFriend {
  userId: string;
  userName: string;
  ratings: FriendRating[];
}

/** How recent a friend's rating must be to ping. */
export const QUEUE_TRIGGER_WINDOW_DAYS = 7;
/** Cap so a busy circle can't turn the bell into noise. */
export const QUEUE_TRIGGER_LIMIT = 3;

/**
 * Notifications for friends' recent ratings of the viewer's queued items,
 * newest first, one per item (the most recent friend rating wins so the ping
 * always reflects the freshest opinion). Ratings without `ratedAt` (local
 * snapshots) can't prove recency and never ping.
 */
export function queueTriggerNotifications(
  friends: QueueTriggerFriend[],
  queuedItemIds: Set<string>,
  now: Date,
  opts: { windowDays?: number; limit?: number } = {},
): AppNotification[] {
  if (queuedItemIds.size === 0) return [];
  const cutoff =
    now.getTime() - (opts.windowDays ?? QUEUE_TRIGGER_WINDOW_DAYS) * 24 * 60 * 60 * 1000;

  // Newest qualifying rating per queued item.
  const best = new Map<string, { friend: QueueTriggerFriend; rating: FriendRating }>();
  for (const friend of friends) {
    for (const r of friend.ratings) {
      if (!queuedItemIds.has(r.item.id) || r.item.type === 'artist') continue;
      const t = r.ratedAt ? Date.parse(r.ratedAt) : NaN;
      if (!Number.isFinite(t) || t < cutoff) continue;
      const held = best.get(r.item.id);
      if (!held || (r.ratedAt as string) > (held.rating.ratedAt as string)) {
        best.set(r.item.id, { friend, rating: r });
      }
    }
  }

  return [...best.values()]
    .sort((a, b) => (b.rating.ratedAt as string).localeCompare(a.rating.ratedAt as string))
    .slice(0, opts.limit ?? QUEUE_TRIGGER_LIMIT)
    .map(({ friend, rating }) => ({
      id: `queue-${rating.item.id}-${friend.userId}`,
      kind: 'queue' as const,
      actorId: friend.userId,
      actorName: friend.userName,
      createdAt: rating.ratedAt as string,
      subject: rating.item.title,
      excerpt: `${rating.score.toFixed(1)} — it's on your want-to-listen list`,
      itemId: rating.item.id,
      itemType: rating.item.type === 'song' ? ('song' as const) : ('album' as const),
    }));
}
