/**
 * Pure row ↔ model mapping for diary entries (0011_diary.sql) plus the
 * group-by-day rollup the timeline screen renders. Offline-testable, same split
 * as src/concerts/rows.ts and src/feed/rows.ts.
 */

import type { ItemType } from '@/ranking/types';

import type { DiaryEntry } from './types';

/** public.diary_entries select shape. */
export interface DiaryRow {
  id: string;
  user_id: string;
  item_id: string;
  item_type: string;
  item_title: string;
  item_artist: string;
  item_art_url: string | null;
  score: number | null;
  note: string | null;
  logged_at: string;
  created_at: string;
}

export function fromDiaryRow(row: DiaryRow): DiaryEntry {
  return {
    id: row.id,
    userId: row.user_id,
    item: {
      id: row.item_id,
      type: row.item_type as ItemType,
      title: row.item_title,
      artist: row.item_artist,
      artUrl: row.item_art_url ?? undefined,
    },
    score: row.score ?? 0,
    note: row.note ?? undefined,
    loggedAt: row.logged_at,
    createdAt: row.created_at,
  };
}

export function toDiaryRow(entry: Omit<DiaryEntry, 'id' | 'createdAt'>): Omit<DiaryRow, 'id' | 'created_at'> {
  return {
    user_id: entry.userId,
    item_id: entry.item.id,
    item_type: entry.item.type,
    item_title: entry.item.title,
    item_artist: entry.item.artist,
    item_art_url: entry.item.artUrl ?? null,
    score: entry.score,
    note: entry.note ?? null,
    logged_at: entry.loggedAt,
  };
}

/** Newest first: by diary date, then by write time within a day. */
export function sortDiary(entries: DiaryEntry[]): DiaryEntry[] {
  return [...entries].sort(
    (a, b) => b.loggedAt.localeCompare(a.loggedAt) || b.createdAt.localeCompare(a.createdAt),
  );
}

export interface DiaryDay {
  /** 'YYYY-MM-DD'. */
  date: string;
  entries: DiaryEntry[];
}

/** Group a diary into day sections, newest day first, entries newest-first within. */
export function groupByDay(entries: DiaryEntry[]): DiaryDay[] {
  const sorted = sortDiary(entries);
  const days: DiaryDay[] = [];
  for (const entry of sorted) {
    const last = days[days.length - 1];
    if (last && last.date === entry.loggedAt) last.entries.push(entry);
    else days.push({ date: entry.loggedAt, entries: [entry] });
  }
  return days;
}

/** Local 'YYYY-MM-DD' for a Date (the diary's default logged_at). */
export function todayDateKey(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** "Jul 12, 2026" from a 'YYYY-MM-DD' key (no timezone drift — parsed as parts). */
export function formatDiaryDate(dateKey: string): string {
  const [y, m, d] = dateKey.split('-').map((n) => Number.parseInt(n, 10));
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  if (!y || !m || !d || m < 1 || m > 12) return dateKey;
  return `${MONTHS[m - 1]} ${d}, ${y}`;
}
