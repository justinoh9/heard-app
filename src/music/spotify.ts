/**
 * Spotify catalog: searches albums and tracks via the Spotify Web API, using
 * the Client Credentials flow (app-level auth, no user login) to mint a bearer
 * token. This is the provider SPEC §7 planned for — it fixes the two search
 * gaps MusicBrainz couldn't: results carry a native `popularity` signal (so we
 * can rank by it) and Spotify's search relevance already prioritizes the
 * artist you meant instead of surfacing unrelated same-title releases.
 *
 * Docs: https://developer.spotify.com/documentation/web-api/tutorials/client-credentials-flow
 *       https://developer.spotify.com/documentation/web-api/reference/search
 *
 * SECURITY: the Client Credentials flow needs a client secret. This app has no
 * backend, so the secret is read from `EXPO_PUBLIC_SPOTIFY_CLIENT_SECRET` and
 * therefore ships in the client bundle — the same trust level as the Supabase
 * anon key and the client-supplied `user_id` elsewhere in this prototype. Move
 * token minting behind a backend endpoint before any real launch (SPEC §7).
 */

import {
  MusicCatalogError,
  type MusicCatalog,
  type SearchOptions,
  type SearchResult,
} from './types';

const TOKEN_URL = 'https://accounts.spotify.com/api/token';
const API = 'https://api.spotify.com/v1';

interface SpotifyImage {
  url: string;
  width?: number | null;
  height?: number | null;
}

interface SpotifyArtist {
  name: string;
}

interface SpotifyAlbumObject {
  id: string;
  name: string;
  album_type?: string;
  release_date?: string;
  images?: SpotifyImage[];
  artists?: SpotifyArtist[];
}

interface SpotifyTrackObject {
  id: string;
  name: string;
  popularity?: number;
  preview_url?: string | null;
  album?: SpotifyAlbumObject;
  artists?: SpotifyArtist[];
}

interface SpotifySearchResponse {
  albums?: { items?: SpotifyAlbumObject[] };
  tracks?: { items?: SpotifyTrackObject[] };
}

interface SpotifyTokenResponse {
  access_token?: string;
  expires_in?: number;
}

/**
 * base64-encode an ASCII string. Prefers the platform `btoa` (present on web
 * and modern Hermes/Node); the manual fallback keeps native builds working on
 * runtimes that don't expose it. Only ever fed `clientId:clientSecret`, which
 * is pure ASCII.
 */
const B64_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
export function base64(input: string): string {
  const g = globalThis as { btoa?: (s: string) => string };
  if (typeof g.btoa === 'function') return g.btoa(input);
  let out = '';
  for (let i = 0; i < input.length; i += 3) {
    const c0 = input.charCodeAt(i);
    const c1 = input.charCodeAt(i + 1);
    const c2 = input.charCodeAt(i + 2);
    out += B64_ALPHABET[c0 >> 2];
    out += B64_ALPHABET[((c0 & 3) << 4) | (Number.isNaN(c1) ? 0 : c1 >> 4)];
    if (Number.isNaN(c1)) {
      out += '==';
    } else {
      out += B64_ALPHABET[((c1 & 15) << 2) | (Number.isNaN(c2) ? 0 : c2 >> 6)];
      out += Number.isNaN(c2) ? '=' : B64_ALPHABET[c2 & 63];
    }
  }
  return out;
}

function artistNames(artists?: SpotifyArtist[]): string {
  if (!artists?.length) return 'Unknown artist';
  return artists.map((a) => a.name).join(', ');
}

/** 'album' → 'Album', 'single' → 'Single', etc. — for the UI's type label. */
function primaryTypeLabel(type?: string): string | undefined {
  if (!type) return undefined;
  return type.charAt(0).toUpperCase() + type.slice(1);
}

/**
 * Pick a cover URL sized for a list thumbnail. Spotify returns images widest
 * first; we take the smallest that's still >=200px (usually the 300px art),
 * falling back to the widest, then to nothing.
 */
export function pickCover(images?: SpotifyImage[]): string | undefined {
  if (!images?.length) return undefined;
  const usable = images
    .filter((img) => typeof img.width === 'number' && (img.width ?? 0) >= 200)
    .sort((a, b) => (a.width ?? 0) - (b.width ?? 0));
  return (usable[0] ?? images[0]).url;
}

/**
 * Pure: map a Spotify search response's albums to album results, full albums
 * sorted before singles/compilations (mirrors the old catalog's album-first
 * ordering). Separated from the fetch so it can be unit-tested offline.
 */
export function parseAlbumResults(json: SpotifySearchResponse): SearchResult[] {
  const items = json.albums?.items ?? [];
  const results: SearchResult[] = items.map((a) => ({
    id: a.id,
    kind: 'album',
    title: a.name,
    artist: artistNames(a.artists),
    year: a.release_date?.slice(0, 4) || undefined,
    coverUrl: pickCover(a.images),
    primaryType: primaryTypeLabel(a.album_type),
    provider: 'spotify',
  }));
  return results.sort(
    (a, b) => (a.primaryType === 'Album' ? 0 : 1) - (b.primaryType === 'Album' ? 0 : 1),
  );
}

/**
 * Pure: map a Spotify search response's tracks to song results, ranked by
 * Spotify's native popularity (highest first) — the signal MusicBrainz never
 * had (SPEC §5). Cover art and album title come from the track's album.
 */
export function parseTrackResults(json: SpotifySearchResponse): SearchResult[] {
  const items = json.tracks?.items ?? [];
  const results: SearchResult[] = items.map((t) => ({
    id: t.id,
    kind: 'song',
    title: t.name,
    artist: artistNames(t.artists),
    year: t.album?.release_date?.slice(0, 4) || undefined,
    coverUrl: pickCover(t.album?.images),
    albumTitle: t.album?.name,
    popularity: t.popularity,
    previewUrl: t.preview_url ?? undefined,
    provider: 'spotify',
  }));
  return results.sort((a, b) => (b.popularity ?? 0) - (a.popularity ?? 0));
}

/** Pure: combined album + track results (albums first), for `searchAll`. */
export function parseSearchResults(json: SpotifySearchResponse): SearchResult[] {
  return [...parseAlbumResults(json), ...parseTrackResults(json)];
}

export class SpotifyCatalog implements MusicCatalog {
  readonly provider = 'spotify' as const;

  /** Cached app token; refreshed a minute before it actually expires. */
  private token: { value: string; expiresAt: number } | null = null;
  /** In-flight token fetch, so concurrent searches don't each mint a token. */
  private pendingToken: Promise<string> | null = null;

  /**
   * fetch is injectable so tests don't hit the network. Bound to globalThis
   * because the browser's fetch throws "Illegal invocation" if called with any
   * other `this` (e.g. as a property of this instance).
   */
  constructor(private fetchImpl: typeof fetch = fetch.bind(globalThis)) {}

  private credentials(): { id: string; secret: string } {
    const id = process.env.EXPO_PUBLIC_SPOTIFY_CLIENT_ID;
    const secret = process.env.EXPO_PUBLIC_SPOTIFY_CLIENT_SECRET;
    if (!id || !secret) {
      throw new MusicCatalogError(
        'Spotify search isn’t configured. Add EXPO_PUBLIC_SPOTIFY_CLIENT_ID and EXPO_PUBLIC_SPOTIFY_CLIENT_SECRET to your .env.',
      );
    }
    return { id, secret };
  }

  private async fetchToken(): Promise<string> {
    const { id, secret } = this.credentials();
    // No AbortSignal here on purpose: the token fetch is shared across concurrent
    // searches, so one search being superseded must not cancel it for the others.
    const res = await this.fetchImpl(TOKEN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${base64(`${id}:${secret}`)}`,
      },
      body: 'grant_type=client_credentials',
    }).catch(() => {
      throw new MusicCatalogError('Could not reach Spotify. Check your connection.');
    });

    if (!res.ok) {
      throw new MusicCatalogError(`Spotify authentication failed (${res.status}).`);
    }
    const json = (await res.json()) as SpotifyTokenResponse;
    if (!json.access_token) {
      throw new MusicCatalogError('Spotify did not return an access token.');
    }
    this.token = {
      value: json.access_token,
      expiresAt: Date.now() + ((json.expires_in ?? 3600) - 60) * 1000,
    };
    return json.access_token;
  }

  private async accessToken(): Promise<string> {
    if (this.token && Date.now() < this.token.expiresAt) return this.token.value;
    if (!this.pendingToken) {
      this.pendingToken = this.fetchToken().finally(() => {
        this.pendingToken = null;
      });
    }
    return this.pendingToken;
  }

  private async search(
    types: string,
    query: string,
    limit: number,
    signal?: AbortSignal,
  ): Promise<SpotifySearchResponse> {
    const run = (token: string) => {
      const url = `${API}/search?q=${encodeURIComponent(query)}&type=${types}&limit=${limit}`;
      return this.fetchImpl(url, {
        signal,
        headers: { Accept: 'application/json', Authorization: `Bearer ${token}` },
      }).catch((e: unknown) => {
        // Let aborts propagate so callers can ignore them; wrap everything else.
        if ((e as Error)?.name === 'AbortError') throw e;
        throw new MusicCatalogError('Could not reach Spotify. Check your connection.');
      });
    };

    let res = await run(await this.accessToken());

    // A cached token can expire between mint and use — refresh once and retry.
    if (res.status === 401) {
      this.token = null;
      res = await run(await this.accessToken());
    }

    if (!res.ok) {
      throw new MusicCatalogError(`Spotify search failed (${res.status}).`);
    }
    return (await res.json()) as SpotifySearchResponse;
  }

  async searchAlbums(query: string, opts: SearchOptions = {}): Promise<SearchResult[]> {
    const q = query.trim();
    if (!q) return [];
    return parseAlbumResults(await this.search('album', q, opts.limit ?? 20, opts.signal));
  }

  async searchTracks(query: string, opts: SearchOptions = {}): Promise<SearchResult[]> {
    const q = query.trim();
    if (!q) return [];
    return parseTrackResults(await this.search('track', q, opts.limit ?? 20, opts.signal));
  }

  async searchAll(query: string, opts: SearchOptions = {}): Promise<SearchResult[]> {
    const q = query.trim();
    if (!q) return [];
    // Spotify searches both types in one request — no fan-out like MusicBrainz.
    return parseSearchResults(await this.search('album,track', q, opts.limit ?? 20, opts.signal));
  }
}
