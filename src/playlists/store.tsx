/**
 * Lists context. Screens talk only to `usePlaylists()`; persistence sits behind
 * `PlaylistsBackend` (Supabase or on-device, chosen in provider.ts), hydrated on
 * sign-in and written through optimistically — the same shape as the ratings and
 * concerts stores. Creating a list publishes a `'list'` feed event (blueprint
 * invariant: every meaningful action feeds the activity spine).
 */

import * as Crypto from 'expo-crypto';
import { createContext, useContext, useEffect, useMemo, useState } from 'react';

import { useAuth } from '@/auth/store';
import { useSocial } from '@/social/store';

import { upsertSong, removeSongById } from './helpers';
import { playlistsBackend } from './provider';
import { sortPlaylists } from './rows';
import type { Playlist, PlaylistSong } from './types';

export interface PlaylistsApi {
  playlists: Playlist[];
  loading: boolean;
  getPlaylist: (id: string) => Playlist | undefined;
  /** Create a list and return it synchronously (caller navigates to it). */
  createPlaylist: (name: string) => Playlist;
  deletePlaylist: (id: string) => void;
  addSong: (playlistId: string, song: PlaylistSong) => void;
  removeSong: (playlistId: string, songId: string) => void;
}

export const PlaylistsContext = createContext<PlaylistsApi | null>(null);

export function usePlaylistsState(): PlaylistsApi {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const social = useSocial();
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) {
      setPlaylists([]);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    playlistsBackend
      .listFor(userId)
      .then((list) => {
        if (!cancelled) setPlaylists(list);
      })
      .catch((e: unknown) => console.warn('[playlists] load failed:', e))
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  return useMemo<PlaylistsApi>(
    () => ({
      playlists,
      loading,
      getPlaylist: (id) => playlists.find((p) => p.id === id),
      createPlaylist: (name) => {
        const draft: Playlist = {
          id: Crypto.randomUUID(),
          userId: userId ?? undefined,
          name: name.trim() || 'New playlist',
          songs: [],
          createdAt: new Date().toISOString(),
        };
        setPlaylists((prev) => [draft, ...prev]);
        if (userId) {
          playlistsBackend
            .create({ id: draft.id, userId, name: draft.name, createdAt: draft.createdAt })
            .catch((e: unknown) => {
              console.warn('[playlists] create failed:', e);
              setPlaylists((prev) => prev.filter((p) => p.id !== draft.id));
            });
          social.publish('list', { title: draft.name });
        }
        return draft;
      },
      deletePlaylist: (id) => {
        const removed = playlists.find((p) => p.id === id);
        setPlaylists((prev) => prev.filter((p) => p.id !== id));
        playlistsBackend.remove(id).catch((e: unknown) => {
          console.warn('[playlists] delete failed:', e);
          if (removed) setPlaylists((prev) => sortPlaylists([removed, ...prev]));
        });
      },
      addSong: (playlistId, song) => {
        let position = 0;
        setPlaylists((prev) =>
          prev.map((p) => {
            if (p.id !== playlistId) return p;
            position = p.songs.length;
            return { ...p, songs: upsertSong(p.songs, song) };
          }),
        );
        playlistsBackend
          .addSong(playlistId, song, position)
          .catch((e: unknown) => console.warn('[playlists] addSong failed:', e));
      },
      removeSong: (playlistId, songId) => {
        setPlaylists((prev) =>
          prev.map((p) =>
            p.id === playlistId ? { ...p, songs: removeSongById(p.songs, songId) } : p,
          ),
        );
        playlistsBackend
          .removeSong(playlistId, songId)
          .catch((e: unknown) => console.warn('[playlists] removeSong failed:', e));
      },
    }),
    [playlists, loading, userId, social],
  );
}

export function usePlaylists(): PlaylistsApi {
  const ctx = useContext(PlaylistsContext);
  if (!ctx) throw new Error('usePlaylists must be used within PlaylistsContext.Provider');
  return ctx;
}
