/**
 * Last.fm popularity enrichment. iTunes (src/music/itunes.ts) has great artwork
 * and previews but no popularity signal, so we borrow one from Last.fm's
 * `track.search`, which returns a `listeners` count per hit. We fire one extra
 * request per search, keyed on the same query, build an (artist|title) → count
 * map, and attach a log-scaled 0-100 `popularity` to whichever iTunes results
 * match — then stable-sort so scored songs float up and everything unmatched
 * keeps its iTunes relevance order.
 *
 * Best-effort by contract (PopularityEnricher): no API key, a failed request,
 * or a query with no matches all fall back to the catalog's own ordering. The
 * only thing propagated is an AbortError (a superseded search), so the search
 * hook can ignore it instead of rendering stale results.
 *
 * Docs: https://www.last.fm/api/show/track.search
 * The API key is a plain public query param (no OAuth, no secret) — set
 * EXPO_PUBLIC_LASTFM_API_KEY to enable; unset simply disables enrichment.
 */

import type { PopularityEnricher, SearchOptions, SearchResult } from './types';

const API = 'https://ws.audioscrobbler.com/2.0/';

/**
 * Listener count that maps to a popularity of ~100. Chosen so today's biggest
 * tracks (a few million listeners) land near the top of the scale. The exact
 * value only shifts the displayed number — ordering is monotonic in listeners
 * regardless — so it's a display calibration, not a correctness knob.
 */
const POPULARITY_REFERENCE = 5_000_000;

/** How many Last.fm hits to pull per search — enough to cover an iTunes page. */
const SEARCH_LIMIT = 30;

interface LastfmTrackHit {
  name?: string;
  artist?: string;
  listeners?: string;
}

interface LastfmTrackSearchResponse {
  results?: {
    trackmatches?: {
      // Last.fm returns an array for many hits, a bare object for exactly one,
      // and omits the key entirely for none.
      track?: LastfmTrackHit[] | LastfmTrackHit;
    };
  };
}

/**
 * Pure: normalize a track name for matching — lowercased, trimmed, with
 * parenthetical/bracketed suffixes ("(feat. …)", "[Remastered]") and any
 * " - …" tail stripped, so iTunes and Last.fm spellings line up more often.
 */
export function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/\s*[([].*?[)\]]\s*/g, ' ')
    .replace(/\s+-\s+.*$/, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Pure: the map key for a track — normalized "artist|title". */
export function matchKey(artist: string, title: string): string {
  return `${normalizeTitle(artist)}|${normalizeTitle(title)}`;
}

/** Pure: a raw listener count → a log-scaled 0-100 popularity. */
export function scalePopularity(listeners: number): number {
  if (!(listeners > 0)) return 0;
  const scaled = (Math.log10(listeners + 1) / Math.log10(POPULARITY_REFERENCE)) * 100;
  return Math.max(0, Math.min(100, Math.round(scaled)));
}

/** Pure: pull the track hits out of a track.search response (array | object | none). */
export function parseTrackMatches(json: LastfmTrackSearchResponse): LastfmTrackHit[] {
  const track = json.results?.trackmatches?.track;
  if (!track) return [];
  return Array.isArray(track) ? track : [track];
}

/**
 * Pure: (artist|title) → listener count. When Last.fm lists the same track
 * twice, the higher count wins.
 */
export function buildPopularityMap(hits: LastfmTrackHit[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const hit of hits) {
    if (!hit.name || !hit.artist) continue;
    const listeners = Number.parseInt(hit.listeners ?? '', 10);
    if (!Number.isFinite(listeners)) continue;
    const key = matchKey(hit.artist, hit.name);
    if (listeners > (map.get(key) ?? -1)) map.set(key, listeners);
  }
  return map;
}

/**
 * Pure: attach `popularity` to each song that has a match in the map, then
 * stable-sort by popularity descending. Unmatched songs keep `popularity`
 * undefined and, because the sort is stable and treats them as -1, retain their
 * original relative order below the scored ones.
 */
export function enrichResults(
  songs: SearchResult[],
  popularity: Map<string, number>,
): SearchResult[] {
  const scored = songs.map((s) => {
    const listeners = popularity.get(matchKey(s.artist, s.title));
    return listeners === undefined ? s : { ...s, popularity: scalePopularity(listeners) };
  });
  return scored
    .map((s, i) => ({ s, i }))
    .sort((a, b) => (b.s.popularity ?? -1) - (a.s.popularity ?? -1) || a.i - b.i)
    .map(({ s }) => s);
}

/**
 * Live Last.fm enricher. Disabled (a no-op pass-through) when no API key is
 * configured. `fetchImpl` is injectable so tests never hit the network.
 */
export class LastfmEnricher implements PopularityEnricher {
  constructor(
    private fetchImpl: typeof fetch = fetch.bind(globalThis),
    private apiKey: string | undefined = process.env.EXPO_PUBLIC_LASTFM_API_KEY,
  ) {}

  async enrich(songs: SearchResult[], query: string, opts: SearchOptions = {}): Promise<SearchResult[]> {
    const q = query.trim();
    if (!this.apiKey || songs.length === 0 || !q) return songs;

    const url =
      `${API}?method=track.search&track=${encodeURIComponent(q)}` +
      `&api_key=${encodeURIComponent(this.apiKey)}&format=json&limit=${SEARCH_LIMIT}`;

    try {
      const res = await this.fetchImpl(url, {
        signal: opts.signal,
        headers: { Accept: 'application/json' },
      });
      if (!res.ok) return songs; // enrichment is optional — never fail the search
      const json = (await res.json()) as LastfmTrackSearchResponse;
      return enrichResults(songs, buildPopularityMap(parseTrackMatches(json)));
    } catch (e) {
      // A superseded search aborts this too — let the hook ignore it. Anything
      // else (network, parse) just means "no popularity this time".
      if ((e as Error)?.name === 'AbortError') throw e;
      return songs;
    }
  }
}
