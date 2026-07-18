/**
 * Likes seam. Supabase-backed from day one, mirroring src/comments/ — a like
 * is only meaningful as a shared signal, not on-device state. One generic
 * backend covers both item likes (song/album profile) and comment likes,
 * discriminated by `LikeTargetType` (see supabase/migrations/0002_likes.sql).
 */

export type LikeTargetType = 'item' | 'comment';

export interface LikeSummary {
  targetId: string;
  count: number;
  likedByMe: boolean;
}

/** A single raw like row, backend-agnostic (Supabase row shape lives in supabase-backend.ts). */
export interface LikeRow {
  targetId: string;
  userId: string;
}

/** Thrown for expected, user-facing failures (network down, bad status). */
export class LikesError extends Error {}

/**
 * What a toggle actually did — not merely what state it ended in.
 *
 * The distinction matters because `toggle` is read-then-write and therefore
 * racy: two concurrent calls on a liked target both see the row and both issue
 * the delete, and a delete that removes nothing still *succeeds*. Reporting
 * only `likedByMe: false` made both calls look like they'd removed a like, so
 * the client subtracted twice — the counter drifted negative (a real -13 on the
 * item screen). `delta` is what THIS call changed, so applying it is safe no
 * matter how many run at once.
 */
export interface LikeToggleResult {
  /** The user's state after this call. */
  likedByMe: boolean;
  /** The change this call is responsible for. 0 when another call got there first. */
  delta: -1 | 0 | 1;
}

export interface LikesBackend {
  listForTargets(
    targetType: LikeTargetType,
    targetIds: string[],
    userId: string,
  ): Promise<Map<string, LikeSummary>>;
  /** Toggle the current user's like on one target. */
  toggle(targetType: LikeTargetType, targetId: string, userId: string): Promise<LikeToggleResult>;
}
