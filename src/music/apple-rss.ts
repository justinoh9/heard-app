/**
 * Apple Marketing Tools RSS — the "New releases" feed for Browse (ROADMAP G2
 * follow-up). Apple retired the dedicated new-music feed (the v2 API 404s on
 * `new-releases`, checked 2026-07-18), so this reads the most-played albums
 * chart — whose entries carry `releaseDate` — and keeps the recent slice:
 * new releases people are actually playing.
 *
 * Keyless like iTunes search, but NOT CORS-open: the API sends no
 * Access-Control-Allow-Origin. On web the fetch goes through a same-origin
 * Vercel rewrite (`/feeds/new-releases-albums.json` in vercel.json); only
 * native fetches Apple directly. The transport lives in
 * `apple-rss-request.ts` (it needs Platform) — this file is pure parsing so
 * the node test runner can load it.
 *
 * Album `id`s are iTunes collectionIds — the same namespace ITunesCatalog
 * uses — so a release row can open `/item/[id]` like any searched album.
 */

import { upscaleArtwork } from './itunes';

export const APPLE_RSS_FEED_URL =
  'https://rss.marketingtools.apple.com/api/v2/us/music/most-played/50/albums.json';
/** Same feed, proxied same-origin by a vercel.json rewrite (web CORS). */
export const APPLE_RSS_PROXY_PATH = '/feeds/new-releases-albums.json';

/** How far back a chart entry still counts as a "new release". */
export const NEW_RELEASE_WINDOW_DAYS = 90;

export interface NewRelease {
  /** iTunes collectionId, as a string. */
  id: string;
  title: string;
  artist: string;
  artUrl?: string;
  /** ISO date, e.g. "2026-07-10". */
  releaseDate: string;
  genre?: string;
}

/** One entry of the v2 feed's `results`. */
interface AppleRssResult {
  id?: string;
  name?: string;
  artistName?: string;
  artworkUrl100?: string;
  releaseDate?: string;
  kind?: string;
  genres?: { name?: string }[];
}

interface AppleRssResponse {
  feed?: { results?: AppleRssResult[] };
}

/**
 * Pure: feed JSON → releases, dropping malformed entries. The catch-all
 * "Music" genre carries no signal (same rule as the Wrapped stats), so the
 * first real genre wins.
 */
export function parseAppleRss(json: AppleRssResponse): NewRelease[] {
  const out: NewRelease[] = [];
  for (const r of json.feed?.results ?? []) {
    if (!r.id || !r.name || !r.artistName || !r.releaseDate) continue;
    if (r.kind !== undefined && r.kind !== 'albums') continue;
    out.push({
      id: r.id,
      title: r.name,
      artist: r.artistName,
      artUrl: upscaleArtwork(r.artworkUrl100),
      releaseDate: r.releaseDate,
      genre: r.genres?.map((g) => g.name).find((n) => n && n !== 'Music') || undefined,
    });
  }
  return out;
}

/**
 * Pure: the releases from the last `windowDays`, newest first, capped. A
 * future-dated entry (a pre-add already charting) counts as brand new rather
 * than being dropped. Entries with unparseable dates are dropped.
 */
export function recentReleases(
  releases: NewRelease[],
  now: Date,
  windowDays = NEW_RELEASE_WINDOW_DAYS,
  limit = 10,
): NewRelease[] {
  const cutoff = now.getTime() - windowDays * 24 * 60 * 60 * 1000;
  return releases
    .filter((r) => {
      const t = Date.parse(r.releaseDate);
      return Number.isFinite(t) && t >= cutoff;
    })
    .sort((a, b) => b.releaseDate.localeCompare(a.releaseDate))
    .slice(0, limit);
}
