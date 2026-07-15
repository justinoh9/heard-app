/**
 * Comments seam. Screens talk only to `CommentsBackend` (via `useComments`),
 * mirroring the auth/ratings/music-catalog seams in this app. Unlike those,
 * this one ships Supabase-backed from day one — durability across devices is
 * the whole point of a public comment, so there's no local-only stage.
 */

import type { SearchResultKind } from '@/music';

export interface Comment {
  id: string;
  itemId: string;
  itemType: SearchResultKind;
  itemTitle: string;
  itemArtist: string;
  itemArtUrl?: string;
  userId: string;
  displayName: string;
  body: string;
  createdAt: string;
  /** Set on a reply — the id of the top-level comment it answers. */
  parentId?: string;
}

export interface NewCommentInput {
  itemId: string;
  itemType: SearchResultKind;
  itemTitle: string;
  itemArtist: string;
  itemArtUrl?: string;
  userId: string;
  displayName: string;
  body: string;
  /** Set to post a reply under an existing comment; omit for a top-level one. */
  parentId?: string;
}

/** Thrown for expected, user-facing failures (network down, bad status). */
export class CommentsError extends Error {}

/** How many TOP-LEVEL comments a page holds (replies to them ride along). */
export const DEFAULT_PAGE_SIZE = 20;

export interface CommentPageRequest {
  /** Top-level comments per page — replies to them are always included. */
  limit?: number;
  /** How many top-level comments to skip. */
  offset?: number;
}

export interface CommentPage {
  /**
   * A flat list of this page's top-level comments plus every reply belonging to
   * them. Flat because `buildThreads` is what folds it — the backend's job is to
   * guarantee no reply arrives without its parent, not to build the tree.
   */
  comments: Comment[];
  hasMore: boolean;
}

export interface CommentsBackend {
  /**
   * One page of an item's comments. Paging counts TOP-LEVEL comments, not rows —
   * see the implementation for why a flat page would silently delete replies.
   */
  listForItem(
    itemId: string,
    itemType: SearchResultKind,
    page?: CommentPageRequest,
  ): Promise<CommentPage>;
  add(input: NewCommentInput): Promise<Comment>;
  /** Delete one of the caller's own comments (RLS enforces ownership too). */
  remove(id: string, userId: string): Promise<void>;
}
