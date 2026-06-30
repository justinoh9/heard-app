/**
 * Playlist types. Playlists are user-curated lists of songs (or albums), held
 * in memory for now (see store.tsx) like ratings and daily drops — Supabase
 * persists them later (SPEC §7) behind the same `usePlaylists()` seam.
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
  name: string;
  songs: PlaylistSong[];
  /** ISO timestamp the playlist was created. */
  createdAt: string;
}
