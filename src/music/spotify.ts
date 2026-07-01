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
 * TOKEN SOURCE (two modes, see `requestToken`):
 *   1. Proxy (recommended) — set `EXPO_PUBLIC_SPOTIFY_TOKEN_URL` to the Supabase
 *      Edge Function in `supabase/functions/spotify-token`. The secret stays
 *      server-side; the client only ever holds a short-lived app token.
 *   2. Direct (quick start) — set `EXPO_PUBLIC_SPOTIFY_CLIENT_ID` +
 *      `EXPO_PUBLIC_SPOTIFY_CLIENT_SECRET`. Simplest, but `EXPO_PUBLIC_*` values
 *      are inlined into the client bundle, so the secret is exposed — the same
 *      trust level as the Supabase anon key elsewhere in this prototype. Fine
 *      for a demo; use mode 1 before any real launch (SPEC §7).
 */

import {
  MusicCatalogError,
  type AlbumTrack,
  type MusicCatalog,
  type SearchOptions,
  type SearchResult,
} from './types';

const TOKEN_URL = 'https://accounts.spotify.com/api/token';
const API = 'https://api.spotify.com/v1';

/**
 * Max page size we'll ask Spotify for. The docs allow up to 50, but apps in
 * Spotify's **Development mode** (i.e. without an approved quota-extension
 * request) are capped at 10 — a larger `limit` returns 400 "Invalid limit". 10
 * is safe in both modes and plenty for a search-as-you-type list, so we clamp
 * to it. Raise this only if the app is granted extended quota.
 */
const MAX_SEARCH_LIMIT = 10;

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
  track_number?: number;
  duration_ms?: number;
  album?: SpotifyAlbumObject;
  artists?: SpotifyArtist[];
}

/** Shape of GET /albums/{id}/tracks (a bare paging object of simplified tracks). */
interface SpotifyAlbumTracksResponse {
  items?: SpotifyTrackObject[];
}

interface SpotifyArtistObject {
  id: string;
  name: string;
  images?: SpotifyImage[];
  popularity?: number;
}

interface SpotifySearchResponse {
  albums?: { items?: SpotifyAlbumObject[] };
  tracks?: { items?: SpotifyTrackObject[] };
  artists?: { items?: SpotifyArtistObject[] };
}

/** Shape of GET /artists/{id}/albums (a bare paging object, not wrapped like search). */
interface SpotifyArtistAlbumsResponse {
  items?: SpotifyAlbumObject[];
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

/**
 * Pure: map a search response's artists to artist results, most popular first.
 * `artist` is left blank (the name lives in `title`). Spotify's current API tier
 * returns only id/name/images for artists — no genres/followers — so the artist
 * page leads with the discography rather than those stats.
 */
export function parseArtistResults(json: SpotifySearchResponse): SearchResult[] {
  const results: SearchResult[] = (json.artists?.items ?? []).map((a) => ({
    id: a.id,
    kind: 'artist',
    title: a.name,
    artist: '',
    coverUrl: pickCover(a.images),
    popularity: a.popularity,
    provider: 'spotify',
  }));
  return results.sort((a, b) => (b.popularity ?? 0) - (a.popularity ?? 0));
}

/**
 * Pure: everything from a mixed search — artists, then albums, then songs. The
 * search UI groups by `kind`, so this order just gives a sensible default.
 */
export function parseSearchResults(json: SpotifySearchResponse): SearchResult[] {
  return [...parseArtistResults(json), ...parseAlbumResults(json), ...parseTrackResults(json)];
}

/** Pure: map GET /albums/{id}/tracks to a tracklist in album order. */
export function parseAlbumTracks(json: SpotifyAlbumTracksResponse): AlbumTrack[] {
  return (json.items ?? []).map((t, i) => ({
    id: t.id,
    title: t.name,
    trackNumber: t.track_number ?? i + 1,
    durationMs: t.duration_ms ?? 0,
    artist: artistNames(t.artists),
  }));
}

/**
 * Pure: map GET /artists/{id}/albums to album results, newest first, collapsing
 * the duplicate entries Spotify returns for the same album across markets.
 */
export function parseArtistAlbums(json: SpotifyArtistAlbumsResponse): SearchResult[] {
  const items = json.items ?? [];
  const seen = new Set<string>();
  const results: SearchResult[] = [];
  for (const a of items) {
    const key = a.name.trim().toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    results.push({
      id: a.id,
      kind: 'album',
      title: a.name,
      artist: artistNames(a.artists),
      year: a.release_date?.slice(0, 4) || undefined,
      coverUrl: pickCover(a.images),
      primaryType: primaryTypeLabel(a.album_type),
      provider: 'spotify',
    });
  }
  // Full albums first (like Spotify's "Albums" section), then singles/EPs;
  // newest first within each group.
  const rank = (r: SearchResult) => (r.primaryType === 'Album' ? 0 : 1);
  return results.sort(
    (a, b) => rank(a) - rank(b) || (b.year ?? '').localeCompare(a.year ?? ''),
  );
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

  /**
   * Where the app token comes from. Prefers the server-side proxy (a Supabase
   * Edge Function, `supabase/functions/spotify-token`) so the client secret
   * never ships in the bundle; falls back to talking to Spotify directly with
   * the embedded secret for a zero-backend quick start. If neither is
   * configured, the error surfaces inline in the search UI.
   *
   * No AbortSignal on the token path on purpose: the fetch is shared across
   * concurrent searches, so one search being superseded must not cancel it for
   * the others.
   */
  private async requestToken(): Promise<SpotifyTokenResponse> {
    const proxyUrl = process.env.EXPO_PUBLIC_SPOTIFY_TOKEN_URL;
    if (proxyUrl) return this.tokenFromProxy(proxyUrl);

    const id = process.env.EXPO_PUBLIC_SPOTIFY_CLIENT_ID;
    const secret = process.env.EXPO_PUBLIC_SPOTIFY_CLIENT_SECRET;
    if (id && secret) return this.tokenDirect(id, secret);

    throw new MusicCatalogError(
      'Spotify search isn’t configured. Set EXPO_PUBLIC_SPOTIFY_TOKEN_URL (recommended), or EXPO_PUBLIC_SPOTIFY_CLIENT_ID + EXPO_PUBLIC_SPOTIFY_CLIENT_SECRET, in your .env.',
    );
  }

  /** Token via the Edge Function proxy — the secret stays server-side. */
  private async tokenFromProxy(url: string): Promise<SpotifyTokenResponse> {
    const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
    const headers: Record<string, string> = { Accept: 'application/json' };
    // Supabase Edge Functions verify a JWT by default; the anon key satisfies it
    // and is already in the bundle. Harmless if the function is --no-verify-jwt.
    if (anonKey) {
      headers.apikey = anonKey;
      headers.Authorization = `Bearer ${anonKey}`;
    }
    const res = await this.fetchImpl(url, { headers }).catch(() => {
      throw new MusicCatalogError('Could not reach the Spotify token service. Check your connection.');
    });
    if (!res.ok) {
      throw new MusicCatalogError(`Spotify token service failed (${res.status}).`);
    }
    return (await res.json()) as SpotifyTokenResponse;
  }

  /** Token straight from Spotify using the embedded secret (quick-start mode). */
  private async tokenDirect(id: string, secret: string): Promise<SpotifyTokenResponse> {
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
    return (await res.json()) as SpotifyTokenResponse;
  }

  private async fetchToken(): Promise<string> {
    const json = await this.requestToken();
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

  /** Clamp any requested limit to Spotify's development-mode ceiling. */
  private cap(limit: number | undefined): number {
    return Math.min(Math.max(1, limit ?? MAX_SEARCH_LIMIT), MAX_SEARCH_LIMIT);
  }

  /**
   * GET a Spotify Web API URL with the app token attached, refreshing once on a
   * 401. Shared by search and the artist-albums lookup.
   */
  private async authedGet(url: string, signal?: AbortSignal): Promise<Response> {
    const run = (token: string) =>
      this.fetchImpl(url, {
        signal,
        headers: { Accept: 'application/json', Authorization: `Bearer ${token}` },
      }).catch((e: unknown) => {
        // Let aborts propagate so callers can ignore them; wrap everything else.
        if ((e as Error)?.name === 'AbortError') throw e;
        throw new MusicCatalogError('Could not reach Spotify. Check your connection.');
      });

    let res = await run(await this.accessToken());
    // A cached token can expire between mint and use — refresh once and retry.
    if (res.status === 401) {
      this.token = null;
      res = await run(await this.accessToken());
    }
    return res;
  }

  private async search(
    types: string,
    query: string,
    limit: number | undefined,
    signal?: AbortSignal,
  ): Promise<SpotifySearchResponse> {
    const url = `${API}/search?q=${encodeURIComponent(query)}&type=${types}&limit=${this.cap(limit)}`;
    const res = await this.authedGet(url, signal);
    if (!res.ok) {
      throw new MusicCatalogError(`Spotify search failed (${res.status}).`);
    }
    return (await res.json()) as SpotifySearchResponse;
  }

  async searchAlbums(query: string, opts: SearchOptions = {}): Promise<SearchResult[]> {
    const q = query.trim();
    if (!q) return [];
    return parseAlbumResults(await this.search('album', q, opts.limit, opts.signal));
  }

  async searchTracks(query: string, opts: SearchOptions = {}): Promise<SearchResult[]> {
    const q = query.trim();
    if (!q) return [];
    return parseTrackResults(await this.search('track', q, opts.limit, opts.signal));
  }

  async searchAll(query: string, opts: SearchOptions = {}): Promise<SearchResult[]> {
    const q = query.trim();
    if (!q) return [];
    // One request for all three types — artists, albums, and songs together.
    return parseSearchResults(await this.search('artist,album,track', q, opts.limit, opts.signal));
  }

  async getArtistAlbums(artistId: string, opts: SearchOptions = {}): Promise<SearchResult[]> {
    const id = artistId.trim();
    if (!id) return [];
    const url = `${API}/artists/${encodeURIComponent(id)}/albums?include_groups=album,single&limit=${this.cap(opts.limit)}`;
    const res = await this.authedGet(url, opts.signal);
    if (!res.ok) {
      throw new MusicCatalogError(`Could not load the artist’s albums (${res.status}).`);
    }
    return parseArtistAlbums((await res.json()) as SpotifyArtistAlbumsResponse);
  }

  async getAlbumTracks(albumId: string, opts: SearchOptions = {}): Promise<AlbumTrack[]> {
    const id = albumId.trim();
    if (!id) return [];
    const url = `${API}/albums/${encodeURIComponent(id)}/tracks?limit=${Math.min(opts.limit ?? 50, 50)}`;
    const res = await this.authedGet(url, opts.signal);
    if (!res.ok) {
      throw new MusicCatalogError(`Could not load the album’s tracks (${res.status}).`);
    }
    return parseAlbumTracks((await res.json()) as SpotifyAlbumTracksResponse);
  }
}
