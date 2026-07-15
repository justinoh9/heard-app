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
  return [...base].sort((a, b) => byTime(a, b, opts.sort));
}

/** A top-level comment with its replies (oldest-first — a thread reads top-down). */
export interface CommentThread {
  comment: Comment;
  replies: Comment[];
}

/**
 * Group a flat comment list into threads: top-level comments (scope-filtered
 * and sorted per `opts`) each carrying their replies in chronological order.
 * Replies are attached regardless of the scope filter — once a parent is
 * visible, the whole conversation under it shows.
 *
 * Replies whose parent is absent are dropped, not promoted to top-level. This
 * is load-bearing for **blocking**: the caller filters a blocked author's
 * comments out before this runs, so a blocked user's thread takes the replies
 * under it with it. A reply stranded from the comment it answers is
 * contextless at best and quotes the blocked user at worst.
 *
 * Never mutates the input array.
 */
export function buildThreads(comments: Comment[], opts: CommentViewOptions): CommentThread[] {
  const roots: Comment[] = [];
  const repliesByParent = new Map<string, Comment[]>();
  for (const c of comments) {
    if (c.parentId) {
      const list = repliesByParent.get(c.parentId) ?? [];
      list.push(c);
      repliesByParent.set(c.parentId, list);
    } else {
      roots.push(c);
    }
  }

  const friends = opts.friends ?? EMPTY;
  const visibleRoots =
    opts.scope === 'friends' ? roots.filter((c) => isFriendComment(c, friends)) : roots;

  return [...visibleRoots]
    .sort((a, b) => byTime(a, b, opts.sort))
    .map((comment) => ({
      comment,
      // Replies always read oldest→newest, independent of the top-level sort.
      replies: (repliesByParent.get(comment.id) ?? [])
        .slice()
        .sort((a, b) => byTime(a, b, 'oldest')),
    }));
}

function byTime(a: Comment, b: Comment, sort: CommentSort): number {
  const ta = Date.parse(a.createdAt);
  const tb = Date.parse(b.createdAt);
  return sort === 'newest' ? tb - ta : ta - tb;
}

const EMPTY: ReadonlySet<string> = new Set();
