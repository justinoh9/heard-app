/**
 * Client-side filter + sort for an item's comments. Pure and framework-free so
 * it's unit-testable like the ranking/social helpers.
 *
 * "Friends" is mock for now (SPEC §7): there's no real social graph, so a
 * comment counts as a friend's when its author display name matches someone in
 * the leaderboard friend roster. Imports are relative to keep this runnable
 * under the `tsx` node test runner.
 */

import { LEADERBOARD_USERS } from '../leaderboard/data';
import type { Comment } from './types';

export type CommentScope = 'everyone' | 'friends';
export type CommentSort = 'newest' | 'oldest';

/** Lowercased display names of the user's friends (mock roster). */
export const FRIEND_NAMES: ReadonlySet<string> = new Set(
  LEADERBOARD_USERS.filter((u) => u.isFriend).map((u) => u.username.trim().toLowerCase()),
);

export function isFriendComment(c: Comment, friends: ReadonlySet<string> = FRIEND_NAMES): boolean {
  return friends.has(c.displayName.trim().toLowerCase());
}

export interface CommentViewOptions {
  scope: CommentScope;
  sort: CommentSort;
  /** Override the friend roster (tests / a future real social graph). */
  friends?: ReadonlySet<string>;
}

/** Apply scope filter then sort by timestamp. Never mutates the input array. */
export function filterSortComments(comments: Comment[], opts: CommentViewOptions): Comment[] {
  const friends = opts.friends ?? FRIEND_NAMES;
  const base =
    opts.scope === 'friends' ? comments.filter((c) => isFriendComment(c, friends)) : comments;
  return [...base].sort((a, b) => {
    const ta = Date.parse(a.createdAt);
    const tb = Date.parse(b.createdAt);
    return opts.sort === 'newest' ? tb - ta : ta - tb;
  });
}
