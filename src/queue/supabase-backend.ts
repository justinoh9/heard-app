/**
 * Supabase-backed want-to-listen queue (0012_queue.sql). One row per
 * (user, item); adding an already-queued item upserts to a no-op, removing
 * deletes by item id.
 */

import { getSupabase } from '@/lib/supabase';

import { fromQueueRow, sortQueue, toQueueRow, type QueueRow } from './rows';
import { QueueError, type QueueBackend, type QueueItem, type QueueInput } from './types';

const COLUMNS = 'id, user_id, item_id, item_type, item_title, item_artist, item_art_url, created_at';

export class SupabaseQueueBackend implements QueueBackend {
  async listFor(userId: string): Promise<QueueItem[]> {
    const { data, error } = await getSupabase()
      .from('queue_items')
      .select(COLUMNS)
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    if (error) throw new QueueError(error.message);
    return sortQueue((data as QueueRow[]).map(fromQueueRow));
  }

  async add(input: QueueInput): Promise<QueueItem> {
    const { data, error } = await getSupabase()
      .from('queue_items')
      .upsert(toQueueRow(input), { onConflict: 'user_id,item_id' })
      .select(COLUMNS)
      .single();
    if (error) throw new QueueError(error.message);
    return fromQueueRow(data as QueueRow);
  }

  async remove(userId: string, itemId: string): Promise<void> {
    const { error } = await getSupabase()
      .from('queue_items')
      .delete()
      .eq('user_id', userId)
      .eq('item_id', itemId);
    if (error) throw new QueueError(error.message);
  }
}
