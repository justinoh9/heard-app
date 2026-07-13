/**
 * Supabase-backed browse (ROADMAP G2). Reads every rating joined to its item in
 * one query and folds them client-side through the pure aggregation — the same
 * "select then tally in memory" posture as the leaderboard. Fine at prototype
 * scale; the Phase-4 "scale the reads" follow-up is to move this to a Postgres
 * view/RPC (materialized `trending`/`top_rated` over ratings×items).
 */

import { getSupabase } from '@/lib/supabase';
import type { ItemType } from '@/ranking/types';

import { aggregateBrowseItems } from './aggregate';
import { BrowseError, type BrowseBackend, type BrowseItem, type RatingWithItem } from './types';

/** Shape of the joined select below (Supabase nests the FK'd item). */
interface BrowseRow {
  score: number | string;
  created_at: string;
  items: {
    id: string;
    type: ItemType;
    title: string;
    artist: string;
    art_url: string | null;
    release_year: number | null;
    genres: string[] | null;
  } | null;
}

function toRatingWithItem(row: BrowseRow): RatingWithItem | null {
  if (!row.items) return null;
  const i = row.items;
  return {
    score: Number(row.score),
    createdAt: row.created_at,
    item: {
      id: i.id,
      type: i.type,
      title: i.title,
      artist: i.artist,
      artUrl: i.art_url ?? undefined,
      releaseYear: i.release_year ?? undefined,
      genres: i.genres ?? undefined,
    },
  };
}

export class SupabaseBrowseBackend implements BrowseBackend {
  async load(): Promise<BrowseItem[]> {
    const { data, error } = await getSupabase()
      .from('ratings')
      .select('score, created_at, items (id, type, title, artist, art_url, release_year, genres)');
    if (error) throw new BrowseError(error.message);
    const rows = ((data ?? []) as unknown as BrowseRow[])
      .map(toRatingWithItem)
      .filter((r): r is RatingWithItem => r !== null);
    return aggregateBrowseItems(rows, Date.now());
  }
}
