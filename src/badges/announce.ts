/**
 * Badge announcements (Growth playbook: Social Currency + Public). Badges are
 * computed at read time, so "just earned" has to be derived: compare the
 * current earned set against a device-local seen set and announce the
 * difference as 'badge' feed events.
 *
 * Two rules keep this honest rather than spammy:
 *  - A null seen set (first observation on this device) records a baseline and
 *    announces NOTHING — signing in on a new phone must not replay your
 *    history into the feed.
 *  - Until the caller says the stores have settled, earns are folded into the
 *    seen set silently. Badge inputs hydrate from several backends at
 *    different speeds; announcing during that window would misread "my data
 *    just finished loading" as "I just earned six badges".
 *
 * Pure and framework-free (relative imports only) so it runs under the tsx
 * node test runner; the AnnouncerBridge in _layout owns the stores and timing.
 */

import type { Badge } from './compute';

/** Never announce more than this many earns from one pass. A single log can
 *  legitimately earn two badges; more than three at once reads as a glitch. */
export const ANNOUNCE_CAP = 3;

export interface AnnouncePlan {
  /** Badges to publish feed events for, in ladder order. */
  announce: Badge[];
  /** The seen set to persist — always the union, even when nothing fires. */
  seen: string[];
}

export function planAnnouncements(
  seenIds: string[] | null,
  badges: Badge[],
  settled: boolean,
  cap = ANNOUNCE_CAP,
): AnnouncePlan {
  const earned = badges.filter((b) => b.earned);
  const earnedIds = earned.map((b) => b.id);

  if (seenIds === null || !settled) {
    return { announce: [], seen: earnedIds };
  }

  const seen = new Set(seenIds);
  const fresh = earned.filter((b) => !seen.has(b.id));
  return {
    announce: fresh.slice(0, cap),
    // Union, not replacement: a badge whose metric later dips (list deleted,
    // queue emptied) stays seen — badges never un-earn, so they must never
    // re-announce either.
    seen: [...new Set([...seenIds, ...earnedIds])],
  };
}
