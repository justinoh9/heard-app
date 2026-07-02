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

import { sortEvents } from './feed-rows';
import type { NewSocialEvent, Profile, SocialBackend, SocialEvent } from './types';

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
    const next = profiles.filter((p) => p.userId !== profile.userId);
    next.push(profile);
    await AsyncStorage.setItem(PROFILES_KEY, JSON.stringify(next));
  }

  async listProfiles(): Promise<Profile[]> {
    return readJson<Profile[]>(PROFILES_KEY, []);
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

  async feedFor(userIds: string[], limit = 50): Promise<SocialEvent[]> {
    if (userIds.length === 0) return [];
    const wanted = new Set(userIds);
    const log = await readJson<SocialEvent[]>(FEED_KEY, []);
    return sortEvents(log.filter((e) => wanted.has(e.userId))).slice(0, limit);
  }
}
