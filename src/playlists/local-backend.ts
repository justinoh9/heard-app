/**
 * On-device lists backend: one device-global AsyncStorage array (like the
 * local feed/concerts), filtered by owner. A brand-new device is seeded with
 * the demo lists so the Profile strip isn't empty offline; Supabase users get
 * a clean real slate (see supabase-backend.ts).
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

import { upsertSong, removeSongById } from './helpers';
import { sortPlaylists } from './rows';
import { SEED_PLAYLISTS } from './seed';
import type { NewPlaylist, Playlist, PlaylistSong, PlaylistsBackend } from './types';

const PLAYLISTS_KEY = 'heard.playlists';

/** Read the whole store, seeding the demo lists onto a first-ever read. */
async function readAll(seedOwner: string | null): Promise<Playlist[]> {
  const raw = await AsyncStorage.getItem(PLAYLISTS_KEY);
  if (raw !== null) return JSON.parse(raw) as Playlist[];
  // Never initialized: seed the demo lists for whoever asked first.
  const seeded = seedOwner
    ? SEED_PLAYLISTS.map((p) => ({ ...p, userId: seedOwner }))
    : [];
  await AsyncStorage.setItem(PLAYLISTS_KEY, JSON.stringify(seeded));
  return seeded;
}

async function writeAll(all: Playlist[]): Promise<void> {
  await AsyncStorage.setItem(PLAYLISTS_KEY, JSON.stringify(all));
}

export class LocalPlaylistsBackend implements PlaylistsBackend {
  async listFor(userId: string): Promise<Playlist[]> {
    const all = await readAll(userId);
    return sortPlaylists(all.filter((p) => p.userId === userId));
  }

  async create(playlist: NewPlaylist): Promise<Playlist> {
    const stored: Playlist = {
      id: playlist.id,
      userId: playlist.userId,
      name: playlist.name,
      songs: [],
      createdAt: playlist.createdAt,
    };
    const all = await readAll(playlist.userId);
    await writeAll([stored, ...all]);
    return stored;
  }

  async remove(playlistId: string): Promise<void> {
    const all = await readAll(null);
    await writeAll(all.filter((p) => p.id !== playlistId));
  }

  async addSong(playlistId: string, song: PlaylistSong): Promise<void> {
    const all = await readAll(null);
    await writeAll(
      all.map((p) => (p.id === playlistId ? { ...p, songs: upsertSong(p.songs, song) } : p)),
    );
  }

  async removeSong(playlistId: string, songId: string): Promise<void> {
    const all = await readAll(null);
    await writeAll(
      all.map((p) => (p.id === playlistId ? { ...p, songs: removeSongById(p.songs, songId) } : p)),
    );
  }
}
