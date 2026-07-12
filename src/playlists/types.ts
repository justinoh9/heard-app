/**
 * Playlist types + the persistence seam. Playlists are user-curated lists of
 * songs (or albums). Screens talk to `usePlaylists()` (store.tsx); persistence
 * sits behind `ListsBackend` (provider.ts) — Supabase (0010_lists.sql, the
 * `lists`/`list_items` tables) when configured, an on-device AsyncStorage
 * fallback otherwise, mirroring the ratings/concerts/drops seams.
 */

import type { ItemType } from '@/ranking/types';

export interface PlaylistSong {
  id: string;
  title: string;
  artist: string;
  artUrl?: string;
  kind: ItemType;
}

export interface Playlist {
  id: string;
  /** The owner (auth uid) — set on persisted lists. */
  userId?: string;
  name: string;
  songs: PlaylistSong[];
  /** ISO timestamp the playlist was created. */
  createdAt: string;
}

/** Thrown for expected persistence failures — UI-safe message. */
export class ListsError extends Error {}

export interface ListsBackend {
  /** The user's lists, newest first, with their items. */
  listFor(userId: string): Promise<Playlist[]>;
  /** Persist a new (already-id'd) list so navigation targets stay stable. */
  create(list: Playlist): Promise<void>;
  /** Delete a list (items cascade). */
  remove(listId: string): Promise<void>;
  /** Add one song to a list at the given position. */
  addSong(listId: string, song: PlaylistSong, position: number): Promise<void>;
  /** Remove one song from a list. */
  removeSong(listId: string, songId: string): Promise<void>;
}
