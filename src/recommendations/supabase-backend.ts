/**
 * Supabase-backed friend lists (ROADMAP G3). One query fetches every followed
 * user's ratings joined to their items, then groups them by user into ranked
 * lists — the raw material `recommend()` folds. Reuses `fromRatingRow` so the
 * item mapping (year/genre) stays identical to the ratings backend.
 */

import { fromRatingRow, type RatingSelectRow } from '@/data/ratings-rows';
import { getSupabase } from '@/lib/supabase';

import { RecommendationsError, type FriendRatingList, type RecommendationsBackend } from './types';

interface FriendRow extends RatingSelectRow {
  user_id: string;
  created_at: string;
}

export class SupabaseRecommendationsBackend implements RecommendationsBackend {
  async friendLists(userIds: string[]): Promise<FriendRatingList[]> {
    if (userIds.length === 0) return [];
    const { data, error } = await getSupabase()
      .from('ratings')
      .select('user_id, score, tiebreak, created_at, items (id, type, title, artist, art_url, release_year, genres)')
      .in('user_id', userIds);
    if (error) throw new RecommendationsError(error.message);

    const byUser = new Map<string, FriendRatingList>();
    for (const row of (data ?? []) as unknown as FriendRow[]) {
      if (!row.items) continue;
      const list = byUser.get(row.user_id) ?? { userId: row.user_id, ratings: [] };
      list.ratings.push({ ...fromRatingRow(row), ratedAt: row.created_at });
      byUser.set(row.user_id, list);
    }
    return [...byUser.values()];
  }
}
