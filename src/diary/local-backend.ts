/**
 * On-device listen diary: one AsyncStorage list per user. Same-day re-logs of
 * an item replace the existing entry (matching the Supabase unique constraint);
 * a new day appends. Used when Supabase isn't configured.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';

import { sortDiary, todayDateKey } from './rows';
import type { DiaryBackend, DiaryEntry, LogDiaryInput } from './types';

const keyFor = (userId: string) => `heard.diary.${userId}`;
const MAX_ENTRIES = 500;

async function readAll(userId: string): Promise<DiaryEntry[]> {
  const raw = await AsyncStorage.getItem(keyFor(userId));
  return raw ? (JSON.parse(raw) as DiaryEntry[]) : [];
}

export class LocalDiaryBackend implements DiaryBackend {
  async log(input: LogDiaryInput): Promise<DiaryEntry> {
    const loggedAt = input.loggedAt ?? todayDateKey();
    const all = await readAll(input.userId);
    // Same (item, day) → replace, mirroring the DB unique constraint.
    const kept = all.filter((e) => !(e.item.id === input.item.id && e.loggedAt === loggedAt));
    const entry: DiaryEntry = {
      id: Crypto.randomUUID(),
      userId: input.userId,
      item: input.item,
      score: input.score,
      note: input.note,
      loggedAt,
      createdAt: new Date().toISOString(),
    };
    kept.push(entry);
    const capped = kept.length > MAX_ENTRIES ? kept.slice(kept.length - MAX_ENTRIES) : kept;
    await AsyncStorage.setItem(keyFor(input.userId), JSON.stringify(capped));
    return entry;
  }

  async listFor(userId: string, limit = 100): Promise<DiaryEntry[]> {
    return sortDiary(await readAll(userId)).slice(0, limit);
  }
}
