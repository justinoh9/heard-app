import { getSupabase } from '@/lib/supabase';
import type { SearchResultKind } from '@/music';

import {
  CommentsError,
  DEFAULT_PAGE_SIZE,
  type Comment,
  type CommentPage,
  type CommentPageRequest,
  type CommentsBackend,
  type NewCommentInput,
} from './types';

/** Postgres `undefined_column`. PostgREST passes the SQLSTATE through as `code`. */
const COLUMN_MISSING = '42703';

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
  parent_id: string | null;
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
    parentId: row.parent_id ?? undefined,
  };
}

export class SupabaseCommentsBackend implements CommentsBackend {
  /**
   * One page of an item's comments (ROADMAP Phase 4 — "paginate comments").
   *
   * PAGE THE ROOTS, NOT THE ROWS. The obvious version — `select * ... limit 20` —
   * pages a flat list, which cuts threads in half: you would get a reply whose
   * parent fell on the next page, and `buildThreads` drops replies whose parent is
   * missing (deliberately — that's what makes a blocked user's thread vanish with
   * them). The comments would not just be paginated, they would be *gone*.
   *
   * So the page is 20 top-level comments, and then every reply belonging to those
   * 20. A thread arrives whole or not at all. Two round trips instead of one,
   * which is the correct trade: threads that silently lose their replies are the
   * kind of bug nobody reports, they just stop commenting.
   */
  async listForItem(
    itemId: string,
    itemType: SearchResultKind,
    page?: CommentPageRequest,
  ): Promise<CommentPage> {
    const limit = page?.limit ?? DEFAULT_PAGE_SIZE;
    const offset = page?.offset ?? 0;

    // Fetch one extra to learn whether another page exists, without a count(*).
    const roots = await getSupabase()
      .from('comments')
      .select('*')
      .eq('item_id', itemId)
      .eq('item_type', itemType)
      .is('parent_id', null)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit);

    // Degrade gracefully on a project that hasn't run 0016 yet: no parent_id
    // column means no replies exist, so every comment IS a root and a flat page
    // is exactly right. `add()` already omits parent_id for the same reason.
    //
    // This matters more than it looks. Without it, deploying this file before the
    // migration lands takes out comments on every item page — which is precisely
    // what happened. The concerts backend has done this since 0017 and the rule it
    // encodes is: a deploy must never require a migration to have run first,
    // because the two are applied by different people at different times.
    if (roots.error?.code === COLUMN_MISSING) {
      return this.listForItemPre0016(itemId, itemType, limit, offset);
    }
    if (roots.error) throw new CommentsError(roots.error.message);

    const rootRows = (roots.data as CommentRow[]) ?? [];
    const hasMore = rootRows.length > limit;
    const pageRoots = rootRows.slice(0, limit);
    if (pageRoots.length === 0) return { comments: [], hasMore: false };

    // Threads are one level deep (0016: a reply to a reply anchors to its root),
    // so every reply in the page is reachable in this single query.
    const replies = await getSupabase()
      .from('comments')
      .select('*')
      .in(
        'parent_id',
        pageRoots.map((r) => r.id),
      )
      .order('created_at', { ascending: true });
    if (replies.error) throw new CommentsError(replies.error.message);

    return {
      comments: [...pageRoots, ...((replies.data as CommentRow[]) ?? [])].map(fromRow),
      hasMore,
    };
  }

  /**
   * The pre-0016 shape: a flat page, no reply lookup. Correct rather than merely
   * tolerable — without the column there are no replies to lose, so paging rows
   * and paging roots are the same thing.
   */
  private async listForItemPre0016(
    itemId: string,
    itemType: SearchResultKind,
    limit: number,
    offset: number,
  ): Promise<CommentPage> {
    const { data, error } = await getSupabase()
      .from('comments')
      .select('*')
      .eq('item_id', itemId)
      .eq('item_type', itemType)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit);
    if (error) throw new CommentsError(error.message);
    const rows = (data as CommentRow[]) ?? [];
    return { comments: rows.slice(0, limit).map(fromRow), hasMore: rows.length > limit };
  }

  async add(input: NewCommentInput): Promise<Comment> {
    const row: Record<string, unknown> = {
      item_id: input.itemId,
      item_type: input.itemType,
      item_title: input.itemTitle,
      item_artist: input.itemArtist,
      item_art_url: input.itemArtUrl ?? null,
      user_id: input.userId,
      display_name: input.displayName,
      body: input.body,
    };
    // Only send parent_id for an actual reply. Omitting it for top-level
    // comments means they keep inserting fine even before 0016 adds the
    // column — replies are the only path that needs the migration.
    if (input.parentId) row.parent_id = input.parentId;

    const { data, error } = await getSupabase().from('comments').insert(row).select('*').single();

    if (error) throw new CommentsError(error.message);
    return fromRow(data as CommentRow);
  }

  async remove(id: string, userId: string): Promise<void> {
    // `.select()` so an RLS refusal is distinguishable from a real delete —
    // PostgREST reports success either way. See src/likes/supabase-backend.ts.
    const { data, error } = await getSupabase()
      .from('comments')
      .delete()
      .eq('id', id)
      .eq('user_id', userId)
      .select('id');
    if (error) throw new CommentsError(error.message);
    if (!data?.length) throw new CommentsError('That comment could not be deleted.');
  }
}
