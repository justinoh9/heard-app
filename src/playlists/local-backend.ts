/**
 * On-device lists backend: the user's lists in AsyncStorage, keyed by user id.
 * A brand-new local user is seeded with the demo lists (SEED_PLAYLISTS) so a
 * zero-config checkout never opens empty — the same first-run posture as the
 * ratings seed. Against the cloud backend a new user starts empty.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

import { sortLists } from './rows';
import { SEED_PLAYLISTS } from './seed';
import { upsertSong, removeSongById } from './helpers';
import type { ListsBackend, Playlist, PlaylistSong } from './types';

const keyFor = (userId: string) => `heard.lists.${userId}`;

async function readAll(userId: string): Promise<Playlist[] | null> {
  const raw = await AsyncStorage.getItem(keyFor(userId));
  return raw ? (JSON.parse(raw) as Playlist[]) : null;
}

async function writeAll(userId: string, lists: Playlist[]): Promise<void> {
  await AsyncStorage.setItem(keyFor(userId), JSON.stringify(lists));
}

export class LocalListsBackend implements ListsBackend {
  async listFor(userId: string): Promise<Playlist[]> {
    const stored = await readAll(userId);
    if (stored) return sortLists(stored);
    // First run for this local user: seed the demo lists and persist them.
    const seeded = SEED_PLAYLISTS.map((p) => ({ ...p, userId }));
    await writeAll(userId, seeded);
    return sortLists(seeded);
  }

  async create(list: Playlist): Promise<void> {
    const all = (await readAll(list.userId!)) ?? [];
    await writeAll(list.userId!, [list, ...all]);
  }

  async remove(listId: string): Promise<void> {
    // No user context on remove; scan every user key would be costly, so the
    // store passes the owner's lists — but the local API keys by user, so we
    // find and rewrite whichever bucket holds it.
    await mutateOwning(listId, (lists) => lists.filter((l) => l.id !== listId));
  }

  async addSong(listId: string, song: PlaylistSong): Promise<void> {
    await mutateOwning(listId, (lists) =>
      lists.map((l) => (l.id === listId ? { ...l, songs: upsertSong(l.songs, song) } : l)),
    );
  }

  async removeSong(listId: string, songId: string): Promise<void> {
    await mutateOwning(listId, (lists) =>
      lists.map((l) => (l.id === listId ? { ...l, songs: removeSongById(l.songs, songId) } : l)),
    );
  }
}

/**
 * Apply a transform to whichever user bucket contains `listId`. AsyncStorage
 * has no key enumeration guarantees we rely on elsewhere, but getAllKeys is
 * fine for the on-device demo scale.
 */
async function mutateOwning(
  listId: string,
  transform: (lists: Playlist[]) => Playlist[],
): Promise<void> {
  const keys = (await AsyncStorage.getAllKeys()).filter((k) => k.startsWith('heard.lists.'));
  for (const key of keys) {
    const raw = await AsyncStorage.getItem(key);
    if (!raw) continue;
    const lists = JSON.parse(raw) as Playlist[];
    if (!lists.some((l) => l.id === listId)) continue;
    await AsyncStorage.setItem(key, JSON.stringify(transform(lists)));
    return;
  }
}
