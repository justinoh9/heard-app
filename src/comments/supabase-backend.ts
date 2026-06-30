import { getSupabase } from '@/lib/supabase';
import type { SearchResultKind } from '@/music';

import { CommentsError, type Comment, type CommentsBackend, type NewCommentInput } from './types';

interface CommentRow {
  id: string;
  item_id: string;
  item_type: SearchResultKind;
  item_title: string;
  item_artist: string;
  item_art_url: string | null;
  user_id: string;
  display_name: string;
  body: string;
  created_at: string;
}

function fromRow(row: CommentRow): Comment {
  return {
    id: row.id,
    itemId: row.item_id,
    itemType: row.item_type,
    itemTitle: row.item_title,
    itemArtist: row.item_artist,
    itemArtUrl: row.item_art_url ?? undefined,
    userId: row.user_id,
    displayName: row.display_name,
    body: row.body,
    createdAt: row.created_at,
  };
}

export class SupabaseCommentsBackend implements CommentsBackend {
  async listForItem(itemId: string, itemType: SearchResultKind): Promise<Comment[]> {
    const { data, error } = await getSupabase()
      .from('comments')
      .select('*')
      .eq('item_id', itemId)
      .eq('item_type', itemType)
      .order('created_at', { ascending: false });

    if (error) throw new CommentsError(error.message);
    return (data as CommentRow[]).map(fromRow);
  }

  async add(input: NewCommentInput): Promise<Comment> {
    const { data, error } = await getSupabase()
      .from('comments')
      .insert({
        item_id: input.itemId,
        item_type: input.itemType,
        item_title: input.itemTitle,
        item_artist: input.itemArtist,
        item_art_url: input.itemArtUrl ?? null,
        user_id: input.userId,
        display_name: input.displayName,
        body: input.body,
      })
      .select('*')
      .single();

    if (error) throw new CommentsError(error.message);
    return fromRow(data as CommentRow);
  }
}
