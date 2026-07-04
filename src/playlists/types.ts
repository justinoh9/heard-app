/**
 * Playlist (a.k.a. "list") types + the persistence seam. Lists are the
 * Letterboxd growth loop retargeted at music (PRODUCT_BLUEPRINT §1.1): a
 * user-curated, shareable collection. Screens talk only to `usePlaylists()`
 * (store.tsx); persistence sits behind `PlaylistsBackend` — Supabase when
 * configured (0007_lists.sql), an AsyncStorage fallback otherwise — the same
 * one-line swap as ratings/social/concerts.
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
  /** Owner. Optional on legacy/seed rows; set on everything the store creates. */
  userId?: string;
  name: string;
  songs: PlaylistSong[];
  /** ISO timestamp the playlist was created. */
  createdAt: string;
}

/** Identity a caller mints client-side so it can navigate before the write lands. */
export interface NewPlaylist {
  id: string;
  userId: string;
  name: string;
  createdAt: string;
}

/** Thrown for expected persistence failures — UI-safe message. */
export class PlaylistsError extends Error {}

export interface PlaylistsBackend {
  /** The user's lists, newest first. */
  listFor(userId: string): Promise<Playlist[]>;
  /** Persist a new (empty) list under the caller-supplied id. */
  create(playlist: NewPlaylist): Promise<Playlist>;
  /** Delete a list and its songs. */
  remove(playlistId: string): Promise<void>;
  /** Append a song at `position` (ignored if already present). */
  addSong(playlistId: string, song: PlaylistSong, position: number): Promise<void>;
  /** Drop a song by id. */
  removeSong(playlistId: string, songId: string): Promise<void>;
}
