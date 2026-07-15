/**
 * Supabase-backed browse (ROADMAP G2, rebuilt for Phase 4's "scale the reads").
 *
 * This used to `select` every rating joined to its item and tally them in the
 * browser. It now calls the `browse_items` RPC (0024_browse_rpc.sql), which does
 * the tallying in Postgres and returns per-item aggregates — tens of rows instead
 * of the whole ratings table. The pure `trending`/`topRated`/`forGenre` functions
 * still decide what the screen shows; only the counting moved.
 *
 * `aggregate.ts`'s `aggregateBrowseItems` is still the local backend's path, and
 * still tested — the two backends agree on the BrowseItem shape, which is what
 * lets the seam stay honest.
 */

import { getSupabase } from '@/lib/supabase';
import type { ItemType } from '@/ranking/types';

import { TRENDING_WINDOW_MS } from './aggregate';
import {
  BrowseError,
  type BrowseBackend,
  type BrowseItem,
  type BrowseLoadOptions,
} from './types';

/** One row of `browse_items` — already aggregated. */
interface BrowseItemRow {
  id: string;
  type: ItemType;
  title: string;
  artist: string;
  art_url: string | null;
  release_year: number | null;
  genres: string[] | null;
  avg_score: number | string;
  rating_count: number | string;
  recent_count: number | string;
}

/**
 * How many items each section of the union returns. 200 is far more than any
 * screen renders (sections show 20) — the headroom is for the genre and decade
 * chips, which are drawn from whatever this returns.
 */
const PER_SECTION = 200;

/**
 * The trending window is defined once, in the pure module, and passed to the RPC
 * — rather than defaulting on both sides where they could drift apart and nobody
 * would notice which one was lying.
 */
const WINDOW_DAYS = Math.round(TRENDING_WINDOW_MS / (24 * 60 * 60 * 1000));

function fromRow(row: BrowseItemRow): BrowseItem {
  return {
    id: row.id,
    type: row.type,
    title: row.title,
    artist: row.artist,
    artUrl: row.art_url ?? undefined,
    releaseYear: row.release_year ?? undefined,
    genres: row.genres ?? undefined,
    // Postgres returns numeric/bigint as strings over the wire; Number() them
    // here so nothing downstream ever sorts "10" before "9".
    avgScore: Number(row.avg_score),
    ratingCount: Number(row.rating_count),
    recentCount: Number(row.recent_count),
  };
}

export class SupabaseBrowseBackend implements BrowseBackend {
  async load(options?: BrowseLoadOptions): Promise<BrowseItem[]> {
    const genres = options?.genres?.length ? options.genres : null;
    const { data, error } = await getSupabase().rpc('browse_items', {
      p_window_days: WINDOW_DAYS,
      p_per_section: PER_SECTION,
      p_genres: genres,
    });
    if (error) throw new BrowseError(error.message);
    return ((data ?? []) as BrowseItemRow[]).map(fromRow);
  }
}
