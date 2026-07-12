/**
 * Supabase-backed notifications, derived at read time from existing tables:
 *   follow  ← follows where followee_id = me
 *   comment ← comments on items I've rated, by someone else
 *   tag     ← concert_tags where user_id = me (join the show for context)
 *
 * Actor display names are resolved through `profiles` in one batched lookup.
 * No notifications table and no write hooks — the cost is a few reads here.
 */

import { getSupabase } from '@/lib/supabase';

import { mergeNotifications } from './merge';
import { NotificationsError, type AppNotification, type NotificationsBackend } from './types';

/** Cap each source so one noisy source can't crowd out the others. */
const PER_SOURCE = 30;

interface FollowRow {
  follower_id: string;
  created_at: string;
}
interface CommentRow {
  id: string;
  item_id: string;
  item_type: string;
  item_title: string;
  user_id: string;
  display_name: string;
  body: string;
  created_at: string;
}
interface TagRow {
  concert_id: string;
}
interface ConcertRow {
  id: string;
  user_id: string;
  artist_name: string;
  created_at: string;
}

export class SupabaseNotificationsBackend implements NotificationsBackend {
  async listFor(userId: string, myItemIds: string[]): Promise<AppNotification[]> {
    const supabase = getSupabase();

    const [follows, comments, tagJoins] = await Promise.all([
      supabase
        .from('follows')
        .select('follower_id, created_at')
        .eq('followee_id', userId)
        .order('created_at', { ascending: false })
        .limit(PER_SOURCE),
      myItemIds.length > 0
        ? supabase
            .from('comments')
            .select('id, item_id, item_type, item_title, user_id, display_name, body, created_at')
            .in('item_id', myItemIds)
            .neq('user_id', userId)
            .order('created_at', { ascending: false })
            .limit(PER_SOURCE)
        : Promise.resolve({ data: [], error: null }),
      supabase.from('concert_tags').select('concert_id').eq('user_id', userId).limit(PER_SOURCE),
    ]);

    if (follows.error) throw new NotificationsError(follows.error.message);
    if (comments.error) throw new NotificationsError(comments.error.message);
    if (tagJoins.error) throw new NotificationsError(tagJoins.error.message);

    const followRows = (follows.data ?? []) as FollowRow[];
    const commentRows = (comments.data ?? []) as CommentRow[];
    const concertIds = (tagJoins.data as TagRow[] | null ?? []).map((t) => t.concert_id);

    // Shows the user was tagged at (only if there are any tags).
    let concertRows: ConcertRow[] = [];
    if (concertIds.length > 0) {
      const { data, error } = await supabase
        .from('concerts')
        .select('id, user_id, artist_name, created_at')
        .in('id', concertIds)
        .order('created_at', { ascending: false })
        .limit(PER_SOURCE);
      if (error) throw new NotificationsError(error.message);
      concertRows = (data ?? []) as ConcertRow[];
    }

    // One batched profile lookup for every actor id we need a name for.
    const actorIds = new Set<string>([
      ...followRows.map((f) => f.follower_id),
      ...concertRows.map((c) => c.user_id),
    ]);
    const names = await this.resolveNames(actorIds);

    const followNotifs: AppNotification[] = followRows.map((f) => ({
      id: `follow-${f.follower_id}-${f.created_at}`,
      kind: 'follow',
      actorName: names.get(f.follower_id) ?? 'Someone',
      createdAt: f.created_at,
    }));

    const commentNotifs: AppNotification[] = commentRows.map((c) => ({
      id: `comment-${c.id}`,
      kind: 'comment',
      actorName: c.display_name || 'Someone',
      createdAt: c.created_at,
      subject: c.item_title,
      excerpt: c.body.length > 80 ? `${c.body.slice(0, 80)}…` : c.body,
      itemId: c.item_id,
      itemType: c.item_type === 'song' ? 'song' : 'album',
    }));

    const tagNotifs: AppNotification[] = concertRows.map((c) => ({
      id: `tag-${c.id}`,
      kind: 'tag',
      actorName: names.get(c.user_id) ?? 'Someone',
      createdAt: c.created_at,
      subject: c.artist_name,
    }));

    return mergeNotifications(followNotifs, commentNotifs, tagNotifs);
  }

  private async resolveNames(ids: Set<string>): Promise<Map<string, string>> {
    const map = new Map<string, string>();
    if (ids.size === 0) return map;
    const { data, error } = await getSupabase()
      .from('profiles')
      .select('user_id, display_name')
      .in('user_id', [...ids]);
    if (error) throw new NotificationsError(error.message);
    for (const p of (data ?? []) as { user_id: string; display_name: string }[]) {
      map.set(p.user_id, p.display_name);
    }
    return map;
  }
}
