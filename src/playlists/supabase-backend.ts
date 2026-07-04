/**
 * Supabase-backed lists (0007_lists.sql). Same trust-client posture as the
 * rest of the prototype until Supabase Auth lands (blueprint §3.4).
 */

import { getSupabase } from '@/lib/supabase';

import {
  fromListRows,
  sortPlaylists,
  toListItemRow,
  toListRow,
  type ListItemRow,
  type ListRow,
} from './rows';
import {
  PlaylistsError,
  type NewPlaylist,
  type Playlist,
  type PlaylistSong,
  type PlaylistsBackend,
} from './types';

const LIST_COLS = 'id, user_id, name, created_at';
const ITEM_COLS = 'list_id, item_id, title, artist, art_url, kind, position';

export class SupabasePlaylistsBackend implements PlaylistsBackend {
  async listFor(userId: string): Promise<Playlist[]> {
    const supabase = getSupabase();

    const { data: lists, error } = await supabase
      .from('lists')
      .select(LIST_COLS)
      .eq('user_id', userId);
    if (error) throw new PlaylistsError(error.message);
    const listRows = lists as ListRow[];
    if (listRows.length === 0) return [];

    const { data: items, error: itemError } = await supabase
      .from('list_items')
      .select(ITEM_COLS)
      .in('list_id', listRows.map((l) => l.id));
    if (itemError) throw new PlaylistsError(itemError.message);

    const byList = new Map<string, ListItemRow[]>();
    for (const it of items as ListItemRow[]) {
      byList.set(it.list_id, [...(byList.get(it.list_id) ?? []), it]);
    }
    return sortPlaylists(listRows.map((l) => fromListRows(l, byList.get(l.id) ?? [])));
  }

  async create(playlist: NewPlaylist): Promise<Playlist> {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('lists')
      .insert(toListRow(playlist))
      .select(LIST_COLS)
      .single();
    if (error) throw new PlaylistsError(error.message);
    return fromListRows(data as ListRow, []);
  }

  async remove(playlistId: string): Promise<void> {
    const supabase = getSupabase();
    // list_items cascade via FK (see migration).
    const { error } = await supabase.from('lists').delete().eq('id', playlistId);
    if (error) throw new PlaylistsError(error.message);
  }

  async addSong(playlistId: string, song: PlaylistSong, position: number): Promise<void> {
    const supabase = getSupabase();
    const { error } = await supabase
      .from('list_items')
      .upsert(toListItemRow(playlistId, song, position), {
        onConflict: 'list_id,item_id',
        ignoreDuplicates: true,
      });
    if (error) throw new PlaylistsError(error.message);
  }

  async removeSong(playlistId: string, songId: string): Promise<void> {
    const supabase = getSupabase();
    const { error } = await supabase
      .from('list_items')
      .delete()
      .eq('list_id', playlistId)
      .eq('item_id', songId);
    if (error) throw new PlaylistsError(error.message);
  }
}
