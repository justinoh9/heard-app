/**
 * "Popular among people you follow" (ROADMAP G2 follow-up): the social proof
 * cut of the friends' ranked lists the recommendations hook already fetches.
 * Unlike `recommend()` (things you HAVEN'T heard, one attributed friend), this
 * surfaces what your circle collectively rates — including music you've logged
 * too, because seeing your own favorite validated by three friends is the
 * point of the section.
 *
 * React/Supabase-free (relative imports only) so it runs under the tsx node
 * test runner, like recommend.ts and browse/aggregate.ts.
 */

import type { Item } from '../ranking/types';

import type { FriendList } from './recommend';

/** One item with its standing among the viewer's follows. */
export interface PopularPick {
  item: Item;
  /** How many followed friends have rated it. */
  friendCount: number;
  /** Mean score across those friends. */
  avgScore: number;
}

/**
 * Items rated by at least `minFriends` followed friends, most-rated first
 * (ties toward the higher average, then id for determinism). The default
 * floor of 2 keeps "popular" honest — one friend's list is just their list.
 */
export function popularAmongFollows(
  friends: FriendList[],
  opts: { minFriends?: number; limit?: number } = {},
): PopularPick[] {
  const minFriends = opts.minFriends ?? 2;
  const limit = opts.limit ?? 10;

  const tally = new Map<string, { item: Item; sum: number; count: number }>();
  for (const friend of friends) {
    for (const r of friend.ratings) {
      const acc = tally.get(r.item.id) ?? { item: r.item, sum: 0, count: 0 };
      acc.sum += r.score;
      acc.count += 1;
      tally.set(r.item.id, acc);
    }
  }

  return [...tally.values()]
    .filter((t) => t.count >= minFriends)
    .map((t) => ({ item: t.item, friendCount: t.count, avgScore: t.sum / t.count }))
    .sort(
      (a, b) =>
        b.friendCount - a.friendCount ||
        b.avgScore - a.avgScore ||
        a.item.id.localeCompare(b.item.id),
    )
    .slice(0, limit);
}
