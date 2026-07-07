/**
 * Deezer artist images. iTunes serves no artist artwork, so we borrow a photo
 * from Deezer's artist search (which returns real, wide-coverage pictures). The
 * photo URL renders fine anywhere — CDN images aren't subject to CORS — even
 * though Deezer's *JSON API* blocks browser CORS; the platform request layer
 * (src/music/deezer-request.ts) handles that with JSONP on web / fetch on
 * native. This module stays pure + injectable so node tests can exercise it.
 *
 * Best-effort by contract (ArtistImageProvider): no match, a failed request, or
 * a placeholder silhouette all resolve to `undefined`, and the UI keeps its
 * album-cover fallback. Results are cached per name (including misses) so an
 * artist is only ever looked up once.
 *
 * Docs: https://developers.deezer.com/api/search  (…/search/artist)
 */

import type { ArtistImageProvider, SearchOptions } from './types';

const API = 'https://api.deezer.com';

export interface DeezerArtist {
  id?: number;
  name?: string;
  picture?: string;
  picture_small?: string;
  picture_medium?: string;
  picture_big?: string;
  picture_xl?: string;
}

export interface DeezerSearchResponse {
  data?: DeezerArtist[];
  error?: unknown;
}

/** The Deezer artist-search URL for a name (the request layer appends jsonp params). */
export function artistSearchUrl(name: string): string {
  return `${API}/search/artist?q=${encodeURIComponent(name)}&limit=1`;
}

/**
 * Deezer hands back a silhouette placeholder — a URL with an empty artist-hash
 * segment (".../artist//…") — when it has no real photo. Treat those as none.
 */
function isRealPicture(url: string | undefined): url is string {
  return !!url && !url.includes('/artist//');
}

/** Pure: the best available picture (xl → big → medium → small → base), or undefined. */
export function pickArtistPicture(a: DeezerArtist | undefined): string | undefined {
  if (!a) return undefined;
  return [a.picture_xl, a.picture_big, a.picture_medium, a.picture_small, a.picture].find(isRealPicture);
}

/** Pure: the first artist's picture from a search response, or undefined. */
export function parseArtistImage(json: DeezerSearchResponse): string | undefined {
  return pickArtistPicture(json.data?.[0]);
}

export class DeezerArtistImages implements ArtistImageProvider {
  /** name → resolved photo (or undefined). A negative entry prevents re-lookups. */
  private cache = new Map<string, string | undefined>();

  /**
   * `request` performs the actual JSON fetch (JSONP on web, fetch on native) —
   * injected so this class stays pure and testable.
   */
  constructor(private request: (url: string, opts?: SearchOptions) => Promise<DeezerSearchResponse>) {}

  async getArtistImage(name: string, opts: SearchOptions = {}): Promise<string | undefined> {
    const key = name.trim().toLowerCase();
    if (!key) return undefined;
    if (this.cache.has(key)) return this.cache.get(key);
    try {
      const url = parseArtistImage(await this.request(artistSearchUrl(name), opts));
      this.cache.set(key, url);
      return url;
    } catch (e) {
      // A superseded lookup aborts — let the caller ignore it. Everything else
      // just means "no photo this time"; don't cache a transient failure.
      if ((e as Error)?.name === 'AbortError') throw e;
      return undefined;
    }
  }
}
