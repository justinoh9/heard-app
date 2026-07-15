/**
 * On-device social backend: AsyncStorage, shared across the local accounts on
 * this device (LocalAuthBackend supports several), so following and the feed
 * are demoable with zero backend — sign in as two users in the same browser
 * and they can follow each other.
 *
 * Storage is device-global on purpose: profiles and the event log are one
 * shared world, exactly like the hosted table would be.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';

import { demoEntries } from '@/leaderboard/rank';

import { sortEvents } from './feed-rows';
import { HandleTakenError } from './types';
import type {
  ItemRating,
  LeaderboardEntry,
  NewSocialEvent,
  Profile,
  ProfilePage,
  ProfilePatch,
  ProfileSearch,
  SocialBackend,
  SocialEvent,
} from './types';

const PROFILES_KEY = 'heard.social.profiles';
const FEED_KEY = 'heard.social.feed';
const followsKey = (userId: string) => `heard.social.follows.${userId}`;

/** Keep the local log bounded — plenty for a device-local demo feed. */
const MAX_EVENTS = 200;

async function readJson<T>(key: string, fallback: T): Promise<T> {
  const raw = await AsyncStorage.getItem(key);
  return raw ? (JSON.parse(raw) as T) : fallback;
}

export class LocalSocialBackend implements SocialBackend {
  async upsertProfile(profile: Profile): Promise<void> {
    const profiles = await readJson<Profile[]>(PROFILES_KEY, []);
    const existing = profiles.find((p) => p.userId === profile.userId);
    const next = profiles.filter((p) => p.userId !== profile.userId);
    // Preserve fields the sign-in upsert doesn't carry (favorites).
    next.push({ ...existing, ...profile, favorites: profile.favorites ?? existing?.favorites });
    await AsyncStorage.setItem(PROFILES_KEY, JSON.stringify(next));
  }

  async setFavorites(userId: string, itemIds: string[]): Promise<void> {
    const profiles = await readJson<Profile[]>(PROFILES_KEY, []);
    const next = profiles.map((p) =>
      p.userId === userId ? { ...p, favorites: itemIds.slice(0, 4) } : p,
    );
    await AsyncStorage.setItem(PROFILES_KEY, JSON.stringify(next));
  }

  async updateProfile(userId: string, patch: ProfilePatch): Promise<void> {
    const profiles = await readJson<Profile[]>(PROFILES_KEY, []);
    // Case-insensitive handle uniqueness, mirroring the DB index.
    if (patch.handle) {
      const taken = profiles.some(
        (p) => p.userId !== userId && p.handle?.toLowerCase() === patch.handle!.toLowerCase(),
      );
      if (taken) throw new HandleTakenError('That handle is already taken.');
    }
    const apply = (p: Profile): Profile => ({
      ...p,
      handle: patch.handle !== undefined ? patch.handle ?? undefined : p.handle,
      bio: patch.bio !== undefined ? patch.bio ?? undefined : p.bio,
      avatarUrl: patch.avatarUrl !== undefined ? patch.avatarUrl ?? undefined : p.avatarUrl,
    });
    const next = profiles.map((p) => (p.userId === userId ? apply(p) : p));
    await AsyncStorage.setItem(PROFILES_KEY, JSON.stringify(next));
  }

  async listProfiles(): Promise<Profile[]> {
    return readJson<Profile[]>(PROFILES_KEY, []);
  }

  /**
   * Same contract as the Supabase backend — searched, ordered and paginated —
   * just done in memory over a device-local list. Implementing it properly rather
   * than returning everything matters: the People screen's paging is driven by
   * `hasMore`, so a backend that ignored the page arguments would leave the demo
   * with a "Load more" button that loads the same thirty people forever.
   */
  async searchProfiles(search?: ProfileSearch): Promise<ProfilePage> {
    const all = await readJson<Profile[]>(PROFILES_KEY, []);
    const q = search?.query?.trim().toLowerCase();
    const matched = q
      ? all.filter(
          (p) =>
            p.displayName.toLowerCase().includes(q) ||
            (p.handle ?? '').toLowerCase().includes(q),
        )
      : all;
    const sorted = [...matched].sort((a, b) => a.displayName.localeCompare(b.displayName));
    const limit = search?.limit ?? 30;
    const offset = search?.offset ?? 0;
    return {
      profiles: sorted.slice(offset, offset + limit),
      hasMore: sorted.length > offset + limit,
    };
  }

  async profilesByIds(ids: string[]): Promise<Profile[]> {
    if (ids.length === 0) return [];
    const wanted = new Set(ids);
    const all = await readJson<Profile[]>(PROFILES_KEY, []);
    return all.filter((p) => wanted.has(p.userId));
  }

  async following(userId: string): Promise<string[]> {
    return readJson<string[]>(followsKey(userId), []);
  }

  async setFollowing(followerId: string, followeeId: string, follow: boolean): Promise<void> {
    const current = await this.following(followerId);
    const next = follow
      ? [...new Set([...current, followeeId])]
      : current.filter((id) => id !== followeeId);
    await AsyncStorage.setItem(followsKey(followerId), JSON.stringify(next));
  }

  async publishEvent(event: NewSocialEvent): Promise<SocialEvent> {
    const stored: SocialEvent = {
      ...event,
      id: Crypto.randomUUID(),
      createdAt: new Date().toISOString(),
    };
    const log = await readJson<SocialEvent[]>(FEED_KEY, []);
    log.push(stored);
    // Cap from the front (oldest) — the feed only ever reads recent events.
    const capped = log.length > MAX_EVENTS ? log.slice(log.length - MAX_EVENTS) : log;
    await AsyncStorage.setItem(FEED_KEY, JSON.stringify(capped));
    return stored;
  }

  async feedFor(userIds: string[], limit = 50, before?: string): Promise<SocialEvent[]> {
    if (userIds.length === 0) return [];
    const wanted = new Set(userIds);
    const log = await readJson<SocialEvent[]>(FEED_KEY, []);
    const sorted = sortEvents(
      log.filter((e) => wanted.has(e.userId) && (!before || e.createdAt < before)),
    );
    return sorted.slice(0, limit);
  }

  async leaderboard(): Promise<LeaderboardEntry[]> {
    // No-Supabase demo: ratings/concerts/comments live behind other on-device
    // backends we can't cheaply join here, so serve the clearly-demo roster.
    // The screen still injects the live viewer's real counts on top.
    return demoEntries();
  }

  async ratingsForItem(): Promise<ItemRating[]> {
    // Item ratings live in the (separate) ratings backend, not here. Return
    // nothing so the item page shows an honest "no ratings yet" in local mode.
    return [];
  }
}
