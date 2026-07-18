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
 *
 * `queuedAt` maps each queued item id to when the viewer bookmarked it. The
 * ping's `createdAt` is the LATER of the friend's rating and the bookmark —
 * the moment the ping became *eligible* — because `createdAt` is what the
 * unread count compares against last-seen. Stamping the raw rating time would
 * make "you queued something a friend rated three days ago" arrive born-read:
 * in the list, but below the last-seen line, never lighting the bell.
 */
export function queueTriggerNotifications(
  friends: QueueTriggerFriend[],
  queuedAt: Map<string, string>,
  now: Date,
  opts: { windowDays?: number; limit?: number } = {},
): AppNotification[] {
  if (queuedAt.size === 0) return [];
  const cutoff =
    now.getTime() - (opts.windowDays ?? QUEUE_TRIGGER_WINDOW_DAYS) * 24 * 60 * 60 * 1000;

  // Newest qualifying rating per queued item.
  const best = new Map<string, { friend: QueueTriggerFriend; rating: FriendRating }>();
  for (const friend of friends) {
    for (const r of friend.ratings) {
      if (!queuedAt.has(r.item.id) || r.item.type === 'artist') continue;
      const t = r.ratedAt ? Date.parse(r.ratedAt) : NaN;
      if (!Number.isFinite(t) || t < cutoff) continue;
      const held = best.get(r.item.id);
      if (!held || (r.ratedAt as string) > (held.rating.ratedAt as string)) {
        best.set(r.item.id, { friend, rating: r });
      }
    }
  }

  const eligibleAt = ({ rating }: { rating: FriendRating }) => {
    const bookmarked = queuedAt.get(rating.item.id);
    const rated = rating.ratedAt as string;
    return bookmarked && bookmarked > rated ? bookmarked : rated;
  };

  return [...best.values()]
    .sort((a, b) => eligibleAt(b).localeCompare(eligibleAt(a)))
    .slice(0, opts.limit ?? QUEUE_TRIGGER_LIMIT)
    .map((pick) => ({
      id: `queue-${pick.rating.item.id}-${pick.friend.userId}`,
      kind: 'queue' as const,
      actorId: pick.friend.userId,
      actorName: pick.friend.userName,
      createdAt: eligibleAt(pick),
      subject: pick.rating.item.title,
      excerpt: `${pick.rating.score.toFixed(1)} — it's on your want-to-listen list`,
      itemId: pick.rating.item.id,
      itemType: pick.rating.item.type === 'song' ? ('song' as const) : ('album' as const),
    }));
}
