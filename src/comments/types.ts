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
}

/** Thrown for expected, user-facing failures (network down, bad status). */
export class CommentsError extends Error {}

export interface CommentsBackend {
  listForItem(itemId: string, itemType: SearchResultKind): Promise<Comment[]>;
  add(input: NewCommentInput): Promise<Comment>;
}
