/**
 * On-device want-to-listen queue: one AsyncStorage list per user. Adding an
 * already-queued item is a no-op (mirroring the Supabase unique constraint);
 * removing filters by item id. Used when Supabase isn't configured.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';

import { sortQueue } from './rows';
import type { QueueBackend, QueueItem, QueueInput } from './types';

const keyFor = (userId: string) => `heard.queue.${userId}`;

async function readAll(userId: string): Promise<QueueItem[]> {
  const raw = await AsyncStorage.getItem(keyFor(userId));
  return raw ? (JSON.parse(raw) as QueueItem[]) : [];
}

export class LocalQueueBackend implements QueueBackend {
  async listFor(userId: string): Promise<QueueItem[]> {
    return sortQueue(await readAll(userId));
  }

  async add(input: QueueInput): Promise<QueueItem> {
    const all = await readAll(input.userId);
    const existing = all.find((i) => i.itemId === input.itemId);
    if (existing) return existing;
    const item: QueueItem = {
      id: Crypto.randomUUID(),
      itemId: input.itemId,
      type: input.type,
      title: input.title,
      artist: input.artist,
      artUrl: input.artUrl,
      createdAt: new Date().toISOString(),
    };
    await AsyncStorage.setItem(keyFor(input.userId), JSON.stringify([item, ...all]));
    return item;
  }

  async remove(userId: string, itemId: string): Promise<void> {
    const all = await readAll(userId);
    await AsyncStorage.setItem(keyFor(userId), JSON.stringify(all.filter((i) => i.itemId !== itemId)));
  }
}
