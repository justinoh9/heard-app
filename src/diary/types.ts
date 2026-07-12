/**
 * Listen-diary seam (ROADMAP Phase 2; PRODUCT_BLUEPRINT §1.1). A dated,
 * re-loggable entry per active listen — separate from the canonical ranked list
 * (`ratings`). Written on every log action (see data/store.ts commitPlacement);
 * the timeline is read by src/app/diary.tsx. Persistence sits behind
 * `DiaryBackend` (provider.ts): Supabase (0011_diary.sql) or on-device.
 */

import type { ItemType } from '@/ranking/types';

export interface DiaryItem {
  id: string;
  type: ItemType;
  title: string;
  artist: string;
  artUrl?: string;
}

export interface DiaryEntry {
  id: string;
  userId: string;
  item: DiaryItem;
  score: number;
  /** Optional note/review carried from the log flow. */
  note?: string;
  /** 'YYYY-MM-DD' — the diary date (re-loggable across days). */
  loggedAt: string;
  /** ISO timestamp the entry was written. */
  createdAt: string;
}

/** What a log action records. `loggedAt` defaults to today when omitted. */
export interface LogDiaryInput {
  userId: string;
  item: DiaryItem;
  score: number;
  note?: string;
  loggedAt?: string;
}

/** Thrown for expected persistence failures — UI-safe message. */
export class DiaryError extends Error {}

export interface DiaryBackend {
  /** Record a listen (upsert on user+item+day — same-day re-log updates). */
  log(input: LogDiaryInput): Promise<DiaryEntry>;
  /** A user's diary, newest first. */
  listFor(userId: string, limit?: number): Promise<DiaryEntry[]>;
}
