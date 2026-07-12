/**
 * Supabase-backed social graph + feed (0004_social.sql). Same trust-client
 * posture as comments/likes/ratings until Supabase Auth lands (blueprint §3.4).
 */

import { getSupabase } from '@/lib/supabase';
import { tallyLeaderboard } from '@/leaderboard/rank';

import { fromFeedRow, type FeedEventRow } from './feed-rows';
import {
  HandleTakenError,
  SocialError,
  type ItemRating,
  type LeaderboardEntry,
  type NewSocialEvent,
  type Profile,
  type ProfilePatch,
  type SocialBackend,
  type SocialEvent,
} from './types';

interface ProfileRow {
  user_id: string;
  display_name: string;
  favorites?: string[] | null;
  handle?: string | null;
  bio?: string | null;
  avatar_url?: string | null;
}

const PROFILE_COLUMNS = 'user_id, display_name, favorites, handle, bio, avatar_url';

function fromProfileRow(r: ProfileRow): Profile {
  return {
    userId: r.user_id,
    displayName: r.display_name,
    favorites: r.favorites ?? undefined,
    handle: r.handle ?? undefined,
    bio: r.bio ?? undefined,
    avatarUrl: r.avatar_url ?? undefined,
  };
}

export class SupabaseSocialBackend implements SocialBackend {
  async upsertProfile(profile: Profile): Promise<void> {
    const { error } = await getSupabase()
      .from('profiles')
      .upsert(
        { user_id: profile.userId, display_name: profile.displayName },
        { onConflict: 'user_id' },
      );
    if (error) throw new SocialError(error.message);
  }

  async listProfiles(): Promise<Profile[]> {
    const { data, error } = await getSupabase()
      .from('profiles')
      .select(PROFILE_COLUMNS)
      .order('display_name');
    if (error) throw new SocialError(error.message);
    return (data as ProfileRow[]).map(fromProfileRow);
  }

  async updateProfile(userId: string, patch: ProfilePatch): Promise<void> {
    const row: Record<string, string | null> = {};
    if (patch.handle !== undefined) row.handle = patch.handle;
    if (patch.bio !== undefined) row.bio = patch.bio;
    if (patch.avatarUrl !== undefined) row.avatar_url = patch.avatarUrl;
    if (Object.keys(row).length === 0) return;
    const { error } = await getSupabase().from('profiles').update(row).eq('user_id', userId);
    if (error) {
      // 23505 = unique_violation on profiles_handle_lower_idx.
      if (error.code === '23505') throw new HandleTakenError('That handle is already taken.');
      throw new SocialError(error.message);
    }
  }

  async setFavorites(userId: string, itemIds: string[]): Promise<void> {
    // The profile row always exists by now (upserted at sign-in).
    const { error } = await getSupabase()
      .from('profiles')
      .update({ favorites: itemIds.slice(0, 4) })
      .eq('user_id', userId);
    if (error) throw new SocialError(error.message);
  }

  async following(userId: string): Promise<string[]> {
    const { data, error } = await getSupabase()
      .from('follows')
      .select('followee_id')
      .eq('follower_id', userId);
    if (error) throw new SocialError(error.message);
    return (data as { followee_id: string }[]).map((r) => r.followee_id);
  }

  async setFollowing(followerId: string, followeeId: string, follow: boolean): Promise<void> {
    const supabase = getSupabase();
    if (follow) {
      const { error } = await supabase
        .from('follows')
        .upsert(
          { follower_id: followerId, followee_id: followeeId },
          { onConflict: 'follower_id,followee_id' },
        );
      if (error) throw new SocialError(error.message);
    } else {
      const { error } = await supabase
        .from('follows')
        .delete()
        .eq('follower_id', followerId)
        .eq('followee_id', followeeId);
      if (error) throw new SocialError(error.message);
    }
  }

  async publishEvent(event: NewSocialEvent): Promise<SocialEvent> {
    const { data, error } = await getSupabase()
      .from('feed_events')
      .insert({
        user_id: event.userId,
        display_name: event.displayName,
        type: event.type,
        payload: event.payload,
      })
      .select('id, user_id, display_name, type, payload, created_at')
      .single();
    if (error) throw new SocialError(error.message);
    return fromFeedRow(data as FeedEventRow);
  }

  async feedFor(userIds: string[], limit = 50, before?: string): Promise<SocialEvent[]> {
    if (userIds.length === 0) return [];
    let query = getSupabase()
      .from('feed_events')
      .select('id, user_id, display_name, type, payload, created_at')
      .in('user_id', userIds)
      .order('created_at', { ascending: false })
      .limit(limit);
    // Cursor: fetch only events older than the last one already held.
    if (before) query = query.lt('created_at', before);
    const { data, error } = await query;
    if (error) throw new SocialError(error.message);
    return (data as FeedEventRow[]).map(fromFeedRow);
  }

  async leaderboard(): Promise<LeaderboardEntry[]> {
    // Four public reads, then group client-side (pure, tested tally). At this
    // scale plain selects are plenty — revisit with a Postgres view/RPC if the
    // ratings table ever gets large enough that fetching one row per rating hurts
    // (ROADMAP Phase 4, "scale the reads").
    const supabase = getSupabase();
    const [profiles, ratings, concerts, comments] = await Promise.all([
      supabase.from('profiles').select('user_id, display_name'),
      supabase.from('ratings').select('user_id'),
      supabase.from('concerts').select('user_id'),
      supabase.from('comments').select('user_id'),
    ]);
    for (const res of [profiles, ratings, concerts, comments]) {
      if (res.error) throw new SocialError(res.error.message);
    }
    const ids = (rows: { user_id: string }[] | null) => (rows ?? []).map((r) => r.user_id);
    return tallyLeaderboard(
      (profiles.data as { user_id: string; display_name: string }[]).map((p) => ({
        userId: p.user_id,
        displayName: p.display_name,
      })),
      ids(ratings.data as { user_id: string }[]),
      ids(concerts.data as { user_id: string }[]),
      ids(comments.data as { user_id: string }[]),
    );
  }

  async ratingsForItem(itemId: string): Promise<ItemRating[]> {
    const { data, error } = await getSupabase()
      .from('ratings')
      .select('user_id, score')
      .eq('item_id', itemId);
    if (error) throw new SocialError(error.message);
    // numeric(3,1) arrives as a JSON number, but coerce defensively.
    return (data as { user_id: string; score: number | string }[]).map((r) => ({
      userId: r.user_id,
      score: Number(r.score),
    }));
  }
}
