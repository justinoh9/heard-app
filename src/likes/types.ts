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

export interface LikesBackend {
  listForTargets(
    targetType: LikeTargetType,
    targetIds: string[],
    userId: string,
  ): Promise<Map<string, LikeSummary>>;
  /** Toggle the current user's like on one target. Returns the new likedByMe state. */
  toggle(targetType: LikeTargetType, targetId: string, userId: string): Promise<boolean>;
}
