/**
 * The rapid-rate seed for onboarding: a curated set of recognizable albums a
 * new user can quickly react to, so the ranking engine + taste profile start
 * with real signal (ROADMAP Phase 2 — the biggest D1-retention lever).
 *
 * Loaded live from the app's own catalog search (real artwork + years), so the
 * seed isn't a pile of hardcoded art URLs that rot. If search is unavailable
 * (offline / API hiccup), it falls back to the six MBID albums the demo list
 * already ships with, whose Cover Art Archive URLs are stable.
 */

import { INITIAL_RANKED } from '@/data/catalog';
import type { MusicCatalog, SearchResult } from '@/music';
import type { Item } from '@/ranking/types';

/** Iconic, broadly-known albums spanning eras/genres — "title artist" queries. */
export const SEED_QUERIES: readonly string[] = [
  'Blonde Frank Ocean',
  'good kid m.A.A.d city Kendrick Lamar',
  'SOS SZA',
  'IGOR Tyler, The Creator',
  'Currents Tame Impala',
  '1989 Taylor Swift',
  'Rumours Fleetwood Mac',
  'AM Arctic Monkeys',
  'Random Access Memories Daft Punk',
  'Renaissance Beyoncé',
  'OK Computer Radiohead',
  'DAMN Kendrick Lamar',
];

/** Offline fallback: the demo albums (verified Cover Art Archive artwork). */
export const FALLBACK_SEED: Item[] = INITIAL_RANKED.map((r) => r.item);

/** Map a catalog album result onto a rateable Item. */
function toItem(result: SearchResult): Item {
  return {
    id: result.id,
    type: 'album',
    title: result.title,
    artist: result.artist,
    artUrl: result.coverUrl,
    year: result.year,
    genre: result.genre,
  };
}

/**
 * Resolve the seed: run each query, take the top album result that has artwork,
 * dedupe by id. Falls back to FALLBACK_SEED if too few resolve (e.g. offline).
 * Best-effort per query — one failed search never sinks the whole seed.
 */
export async function loadSeedAlbums(
  catalog: MusicCatalog,
  opts: { signal?: AbortSignal; min?: number } = {},
): Promise<Item[]> {
  const min = opts.min ?? 4;
  const results = await Promise.all(
    SEED_QUERIES.map((q) =>
      catalog
        .searchAlbums(q, { limit: 3, signal: opts.signal })
        .then((rows) => rows.find((r) => r.kind === 'album' && !!r.coverUrl))
        .catch(() => undefined),
    ),
  );

  const seen = new Set<string>();
  const items: Item[] = [];
  for (const r of results) {
    if (!r || seen.has(r.id)) continue;
    seen.add(r.id);
    items.push(toItem(r));
  }
  return items.length >= min ? items : FALLBACK_SEED;
}
