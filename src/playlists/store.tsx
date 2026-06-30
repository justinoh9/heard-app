/**
 * In-memory playlist store. Screens talk only to `usePlaylists()`, mirroring the
 * ratings and daily-drop seams — Supabase persistence drops in here later
 * (SPEC §7) without touching the UI.
 */

import { createContext, useContext, useMemo, useState } from 'react';

import { removeSongById, upsertSong } from './helpers';
import { SEED_PLAYLISTS } from './seed';
import type { Playlist, PlaylistSong } from './types';

export interface PlaylistsApi {
  playlists: Playlist[];
  getPlaylist: (id: string) => Playlist | undefined;
  /** Create a playlist and return it (caller navigates to it). */
  createPlaylist: (name: string) => Playlist;
  deletePlaylist: (id: string) => void;
  addSong: (playlistId: string, song: PlaylistSong) => void;
  removeSong: (playlistId: string, songId: string) => void;
}

export const PlaylistsContext = createContext<PlaylistsApi | null>(null);

export function usePlaylistsState(): PlaylistsApi {
  const [playlists, setPlaylists] = useState<Playlist[]>(SEED_PLAYLISTS);

  return useMemo<PlaylistsApi>(
    () => ({
      playlists,
      getPlaylist: (id) => playlists.find((p) => p.id === id),
      createPlaylist: (name) => {
        const playlist: Playlist = {
          id: `pl-${Date.now()}`,
          name: name.trim() || 'New playlist',
          songs: [],
          createdAt: new Date().toISOString(),
        };
        setPlaylists((prev) => [playlist, ...prev]);
        return playlist;
      },
      deletePlaylist: (id) => setPlaylists((prev) => prev.filter((p) => p.id !== id)),
      addSong: (playlistId, song) =>
        setPlaylists((prev) =>
          prev.map((p) => (p.id === playlistId ? { ...p, songs: upsertSong(p.songs, song) } : p)),
        ),
      removeSong: (playlistId, songId) =>
        setPlaylists((prev) =>
          prev.map((p) => (p.id === playlistId ? { ...p, songs: removeSongById(p.songs, songId) } : p)),
        ),
    }),
    [playlists],
  );
}

export function usePlaylists(): PlaylistsApi {
  const ctx = useContext(PlaylistsContext);
  if (!ctx) throw new Error('usePlaylists must be used within PlaylistsContext.Provider');
  return ctx;
}
