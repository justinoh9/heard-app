/**
 * Supabase-backed social graph + feed (0004_social.sql). Same trust-client
 * posture as comments/likes/ratings until Supabase Auth lands (blueprint §3.4).
 */

import { getSupabase } from '@/lib/supabase';

import { fromFeedRow, type FeedEventRow } from './feed-rows';
import {
  SocialError,
  type NewSocialEvent,
  type Profile,
  type SocialBackend,
  type SocialEvent,
} from './types';

interface ProfileRow {
  user_id: string;
  display_name: string;
  favorites?: string[] | null;
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
      .select('user_id, display_name, favorites')
      .order('display_name');
    if (error) throw new SocialError(error.message);
    return (data as ProfileRow[]).map((r) => ({
      userId: r.user_id,
      displayName: r.display_name,
      favorites: r.favorites ?? undefined,
    }));
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

  async feedFor(userIds: string[], limit = 50): Promise<SocialEvent[]> {
    if (userIds.length === 0) return [];
    const { data, error } = await getSupabase()
      .from('feed_events')
      .select('id, user_id, display_name, type, payload, created_at')
      .in('user_id', userIds)
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) throw new SocialError(error.message);
    return (data as FeedEventRow[]).map(fromFeedRow);
  }
}
