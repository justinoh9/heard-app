/**
 * Supabase-backed ratings persistence (0003_ratings.sql). Same trust model as
 * comments/likes: RLS is public-read and trusts the client-supplied user_id
 * until auth migrates to Supabase Auth (blueprint §3.4).
 *
 * A commit writes three things, in FK order:
 *   1. upsert `items`   — cache each rated item's metadata (shared table)
 *   2. upsert `ratings` — the full ranked list (score + tiebreak per item)
 *   3. insert `comparisons` — append-only banked head-to-heads
 */

import { getSupabase } from '@/lib/supabase';
import type { ComparisonEvent, RankedItem } from '@/ranking/types';

import {
  fromComparisonRow,
  fromRatingRow,
  toComparisonRow,
  toItemRow,
  toRatingRow,
  type ComparisonRow,
  type RatingSelectRow,
} from './ratings-rows';
import { RatingsBackendError, type RatingsBackend, type RatingsSnapshot } from './ratings-backend';

export class SupabaseRatingsBackend implements RatingsBackend {
  async load(userId: string): Promise<RatingsSnapshot | null> {
    const supabase = getSupabase();

    const [ratingsRes, comparisonsRes] = await Promise.all([
      supabase
        .from('ratings')
        .select('score, tiebreak, items (id, type, title, artist, art_url, release_year, genres)')
        .eq('user_id', userId),
      supabase
        .from('comparisons')
        .select('winner_id, loser_id, compared_at')
        .eq('user_id', userId)
        .order('compared_at', { ascending: true }),
    ]);

    if (ratingsRes.error) throw new RatingsBackendError(ratingsRes.error.message);
    if (comparisonsRes.error) throw new RatingsBackendError(comparisonsRes.error.message);

    const ratingRows = (ratingsRes.data ?? []) as unknown as RatingSelectRow[];
    const comparisonRows = (comparisonsRes.data ?? []) as ComparisonRow[];
    if (ratingRows.length === 0 && comparisonRows.length === 0) return null;

    return {
      list: ratingRows.map(fromRatingRow),
      events: comparisonRows.map(fromComparisonRow),
    };
  }

  async commit(userId: string, list: RankedItem[], events: ComparisonEvent[]): Promise<void> {
    const supabase = getSupabase();

    // Insert-only: the items cache is shared across users, and 0008 removed the
    // update policy so one user can't rewrite metadata everyone else sees.
    // Already-cached rows keep their first-seen metadata (refresh is a future
    // server-side enrichment job, blueprint §2.A).
    const { error: itemsError } = await supabase
      .from('items')
      .upsert(list.map((r) => toItemRow(r.item)), { onConflict: 'id', ignoreDuplicates: true });
    if (itemsError) throw new RatingsBackendError(itemsError.message);

    const { error: ratingsError } = await supabase
      .from('ratings')
      .upsert(list.map((r) => toRatingRow(userId, r)), { onConflict: 'user_id,item_id' });
    if (ratingsError) throw new RatingsBackendError(ratingsError.message);

    if (events.length > 0) {
      const { error: comparisonsError } = await supabase
        .from('comparisons')
        .insert(events.map((e) => toComparisonRow(userId, e)));
      if (comparisonsError) throw new RatingsBackendError(comparisonsError.message);
    }
  }

  async remove(userId: string, itemId: string): Promise<void> {
    // The banked comparisons stay — they're the training log, not the rating.
    const { error } = await getSupabase()
      .from('ratings')
      .delete()
      .eq('user_id', userId)
      .eq('item_id', itemId);
    if (error) throw new RatingsBackendError(error.message);
  }
}
