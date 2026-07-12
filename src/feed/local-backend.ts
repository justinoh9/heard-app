/**
 * On-device daily-drop backend: one drop per user in AsyncStorage, keyed by
 * user id. Mirrors the concerts/ratings local fallbacks — used when Supabase
 * isn't configured (zero-config checkouts).
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

import { isActiveDrop } from './rows';
import { type DailyDrop, type DropsBackend, type PostDropInput } from './types';

const keyFor = (userId: string) => `heard.drop.${userId}`;

export class LocalDropsBackend implements DropsBackend {
  async current(userId: string): Promise<DailyDrop | null> {
    const raw = await AsyncStorage.getItem(keyFor(userId));
    if (!raw) return null;
    const drop = JSON.parse(raw) as DailyDrop;
    // Expired drops read as "none" and are swept so the store stays clean.
    if (!isActiveDrop(drop)) {
      await AsyncStorage.removeItem(keyFor(userId));
      return null;
    }
    return drop;
  }

  async post(userId: string, input: PostDropInput): Promise<DailyDrop> {
    const drop: DailyDrop = {
      userId,
      item: input.item,
      caption: input.caption,
      createdAt: new Date().toISOString(),
    };
    await AsyncStorage.setItem(keyFor(userId), JSON.stringify(drop));
    return drop;
  }

  async clear(userId: string): Promise<void> {
    await AsyncStorage.removeItem(keyFor(userId));
  }
}
