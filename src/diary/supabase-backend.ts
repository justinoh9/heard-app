/**
 * Supabase-backed listen diary (0011_diary.sql). Upserts on
 * (user_id, item_id, logged_at) so a same-day re-log updates in place while a
 * new day is a new entry.
 */

import { getSupabase } from '@/lib/supabase';

import { fromDiaryRow, sortDiary, todayDateKey, toDiaryRow, type DiaryRow } from './rows';
import { DiaryError, type DiaryBackend, type DiaryEntry, type LogDiaryInput } from './types';

const COLUMNS =
  'id, user_id, item_id, item_type, item_title, item_artist, item_art_url, score, note, logged_at, created_at';

export class SupabaseDiaryBackend implements DiaryBackend {
  async log(input: LogDiaryInput): Promise<DiaryEntry> {
    const row = toDiaryRow({
      userId: input.userId,
      item: input.item,
      score: input.score,
      note: input.note,
      loggedAt: input.loggedAt ?? todayDateKey(),
    });
    const { data, error } = await getSupabase()
      .from('diary_entries')
      .upsert(row, { onConflict: 'user_id,item_id,logged_at' })
      .select(COLUMNS)
      .single();
    if (error) throw new DiaryError(error.message);
    return fromDiaryRow(data as DiaryRow);
  }

  async listFor(userId: string, limit = 100): Promise<DiaryEntry[]> {
    const { data, error } = await getSupabase()
      .from('diary_entries')
      .select(COLUMNS)
      .eq('user_id', userId)
      .order('logged_at', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) throw new DiaryError(error.message);
    return sortDiary((data as DiaryRow[]).map(fromDiaryRow));
  }
}
