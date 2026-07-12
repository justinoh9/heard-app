/**
 * Client-side filter + sort for an item's comments. Pure and framework-free so
 * it's unit-testable like the ranking/social helpers.
 *
 * "Friends" is now the real follow graph: the caller (the item page) passes the
 * set of lowercased display names of people the viewer follows, resolved from
 * `useSocial()`. Guests / not-following pass an empty set, so the Friends tab
 * simply comes back empty. Imports stay relative to run under the `tsx` node
 * test runner.
 */

import type { Comment } from './types';

export type CommentScope = 'everyone' | 'friends';
export type CommentSort = 'newest' | 'oldest';

/** True when the comment's author is in the viewer's friend set (by name). */
export function isFriendComment(c: Comment, friends: ReadonlySet<string>): boolean {
  return friends.has(c.displayName.trim().toLowerCase());
}

export interface CommentViewOptions {
  scope: CommentScope;
  sort: CommentSort;
  /**
   * Lowercased display names of the people the viewer follows. Required for the
   * 'friends' scope; ignored for 'everyone'. Defaults to empty (no friends).
   */
  friends?: ReadonlySet<string>;
}

/** Apply scope filter then sort by timestamp. Never mutates the input array. */
export function filterSortComments(comments: Comment[], opts: CommentViewOptions): Comment[] {
  const friends = opts.friends ?? EMPTY;
  const base =
    opts.scope === 'friends' ? comments.filter((c) => isFriendComment(c, friends)) : comments;
  return [...base].sort((a, b) => {
    const ta = Date.parse(a.createdAt);
    const tb = Date.parse(b.createdAt);
    return opts.sort === 'newest' ? tb - ta : ta - tb;
  });
}

const EMPTY: ReadonlySet<string> = new Set();
