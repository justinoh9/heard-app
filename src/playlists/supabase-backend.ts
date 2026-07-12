/**
 * Supabase-backed lists (0010_lists.sql). Two tables: `lists` (header) and
 * `list_items` (songs, ordered by position). A brand-new user starts empty —
 * the demo seed is local-mode only (see LocalListsBackend).
 */

import { getSupabase } from '@/lib/supabase';

import {
  fromListRow,
  sortLists,
  toListItemRow,
  type ListItemRow,
  type ListRow,
} from './rows';
import { ListsError, type ListsBackend, type Playlist, type PlaylistSong } from './types';

export class SupabaseListsBackend implements ListsBackend {
  async listFor(userId: string): Promise<Playlist[]> {
    const supabase = getSupabase();
    const { data: lists, error } = await supabase
      .from('lists')
      .select('id, user_id, name, created_at')
      .eq('user_id', userId);
    if (error) throw new ListsError(error.message);
    const listRows = (lists ?? []) as ListRow[];
    if (listRows.length === 0) return [];

    const { data: items, error: itemsError } = await supabase
      .from('list_items')
      .select('list_id, song_id, title, artist, art_url, kind, position')
      .in('list_id', listRows.map((l) => l.id));
    if (itemsError) throw new ListsError(itemsError.message);

    const byList = new Map<string, ListItemRow[]>();
    for (const it of (items ?? []) as ListItemRow[]) {
      byList.set(it.list_id, [...(byList.get(it.list_id) ?? []), it]);
    }
    return sortLists(listRows.map((l) => fromListRow(l, byList.get(l.id) ?? [])));
  }

  async create(list: Playlist): Promise<void> {
    // Insert with the client-generated id so the caller's navigation target is
    // stable (the store built the Playlist optimistically before this resolves).
    const { error } = await getSupabase().from('lists').insert({
      id: list.id,
      user_id: list.userId,
      name: list.name,
      created_at: list.createdAt,
    });
    if (error) throw new ListsError(error.message);
  }

  async remove(listId: string): Promise<void> {
    // list_items cascade via the FK.
    const { error } = await getSupabase().from('lists').delete().eq('id', listId);
    if (error) throw new ListsError(error.message);
  }

  async addSong(listId: string, song: PlaylistSong, position: number): Promise<void> {
    const { error } = await getSupabase()
      .from('list_items')
      .upsert(toListItemRow(listId, song, position), { onConflict: 'list_id,song_id' });
    if (error) throw new ListsError(error.message);
  }

  async removeSong(listId: string, songId: string): Promise<void> {
    const { error } = await getSupabase()
      .from('list_items')
      .delete()
      .eq('list_id', listId)
      .eq('song_id', songId);
    if (error) throw new ListsError(error.message);
  }
}
