/**
 * Supabase-backed daily drops (0009_drops.sql). One active row per user
 * (upsert on user_id — the "replace drop" action); the 24h expiry is applied
 * here off created_at so an expired drop reads as none without a server job.
 */

import { getSupabase } from '@/lib/supabase';

import { fromDropRow, isActiveDrop, toDropRow, type DropRow } from './rows';
import { DropsError, type DailyDrop, type DropsBackend, type PostDropInput } from './types';

const COLUMNS = 'user_id, item_id, item_type, item_title, item_artist, item_art_url, caption, created_at';

export class SupabaseDropsBackend implements DropsBackend {
  async current(userId: string): Promise<DailyDrop | null> {
    const { data, error } = await getSupabase()
      .from('drops')
      .select(COLUMNS)
      .eq('user_id', userId)
      .maybeSingle();
    if (error) throw new DropsError(error.message);
    if (!data) return null;
    const drop = fromDropRow(data as DropRow);
    return isActiveDrop(drop) ? drop : null;
  }

  async post(userId: string, input: PostDropInput): Promise<DailyDrop> {
    const drop: DailyDrop = {
      userId,
      item: input.item,
      caption: input.caption,
      createdAt: new Date().toISOString(),
    };
    const { data, error } = await getSupabase()
      .from('drops')
      .upsert(toDropRow(drop), { onConflict: 'user_id' })
      .select(COLUMNS)
      .single();
    if (error) throw new DropsError(error.message);
    return fromDropRow(data as DropRow);
  }

  async clear(userId: string): Promise<void> {
    const { error } = await getSupabase().from('drops').delete().eq('user_id', userId);
    if (error) throw new DropsError(error.message);
  }
}
