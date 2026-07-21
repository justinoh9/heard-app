/**
 * Lists store. Screens talk only to `usePlaylists()`; persistence lives behind
 * the `ListsBackend` seam (provider.ts): Supabase (0010_lists.sql) when
 * configured, an on-device AsyncStorage fallback otherwise. Writes are
 * optimistic — the UI settles instantly and the commit syncs behind it, same
 * posture as ratings/drops.
 *
 * Ids are generated client-side so `createPlaylist` can return synchronously
 * and callers can navigate to /playlist/[id] before the write resolves.
 */

import * as Crypto from 'expo-crypto';
import { createContext, useContext, useEffect, useMemo, useState } from 'react';

import { useAuth } from '@/auth/store';
import { useToast } from '@/components/toast';
import { useSocial } from '@/social/store';

import { removeSongById, upsertSong } from './helpers';
import { listsBackend } from './provider';
import type { ListsBackend, Playlist, PlaylistSong } from './types';

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

/**
 * Fire an optimistic backend write. On failure, put the local state back and
 * say so — this used to only `console.warn`, so a failed `create` left the user
 * inside a playlist that did not exist, with a `made_list` feed event already
 * advertising it to their followers.
 */
function sync(
  op: keyof ListsBackend,
  promise: Promise<unknown>,
  onFailure: () => void,
) {
  promise.catch((e: unknown) => {
    console.warn(`[lists] ${op} failed:`, e);
    onFailure();
  });
}

export function usePlaylistsState(): PlaylistsApi {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const social = useSocial();
  const toast = useToast();
  const [playlists, setPlaylists] = useState<Playlist[]>([]);

  // Hydrate the viewer's lists on sign-in; clear on sign-out.
  useEffect(() => {
    if (!userId) {
      setPlaylists([]);
      return;
    }
    let cancelled = false;
    listsBackend
      .listFor(userId)
      .then((lists) => {
        if (!cancelled) setPlaylists(lists);
      })
      .catch((e: unknown) => console.warn('[lists] load failed:', e));
    return () => {
      cancelled = true;
    };
  }, [userId]);

  return useMemo<PlaylistsApi>(
    () => ({
      playlists,
      getPlaylist: (id) => playlists.find((p) => p.id === id),
      createPlaylist: (name) => {
        const list: Playlist = {
          id: Crypto.randomUUID(),
          userId: userId ?? undefined,
          name: name.trim() || 'New playlist',
          songs: [],
          createdAt: new Date().toISOString(),
        };
        setPlaylists((prev) => [list, ...prev]);
        if (userId) {
          sync('create', listsBackend.create(list), () => {
            setPlaylists((prev) => prev.filter((p) => p.id !== list.id));
            toast("Couldn't save that playlist — check your connection.", '⚠️');
          });
          // Lists ride the feed (blueprint §1.3) — Letterboxd's virality engine.
          social.publish('made_list', { title: list.name });
        }
        return list;
      },
      deletePlaylist: (id) => {
        const previous = playlists;
        setPlaylists((prev) => prev.filter((p) => p.id !== id));
        if (userId)
          sync('remove', listsBackend.remove(id), () => {
            setPlaylists(previous);
            toast("Couldn't delete that playlist — check your connection.", '⚠️');
          });
      },
      addSong: (playlistId, song) => {
        // Position = append index, captured before the optimistic state update.
        const position = playlists.find((p) => p.id === playlistId)?.songs.length ?? 0;
        setPlaylists((prev) =>
          prev.map((p) => (p.id === playlistId ? { ...p, songs: upsertSong(p.songs, song) } : p)),
        );
        if (userId)
          sync('addSong', listsBackend.addSong(playlistId, song, position), () => {
            setPlaylists((prev) =>
              prev.map((p) =>
                p.id === playlistId ? { ...p, songs: removeSongById(p.songs, song.id) } : p,
              ),
            );
            toast("Couldn't add that song — check your connection.", '⚠️');
          });
      },
      removeSong: (playlistId, songId) => {
        const previous = playlists;
        setPlaylists((prev) =>
          prev.map((p) => (p.id === playlistId ? { ...p, songs: removeSongById(p.songs, songId) } : p)),
        );
        if (userId)
          sync('removeSong', listsBackend.removeSong(playlistId, songId), () => {
            setPlaylists(previous);
            toast("Couldn't remove that song — check your connection.", '⚠️');
          });
      },
    }),
    [playlists, userId, social, toast],
  );
}

export function usePlaylists(): PlaylistsApi {
  const ctx = useContext(PlaylistsContext);
  if (!ctx) throw new Error('usePlaylists must be used within PlaylistsContext.Provider');
  return ctx;
}
