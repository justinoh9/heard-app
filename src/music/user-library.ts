/**
 * User library seam (PRODUCT_BLUEPRINT §2.A): the logged-in user's own Spotify
 * data — recently played, top tracks, top artists — behind an interface, kept
 * **separate** from `MusicCatalog` so unauthenticated catalog search never
 * depends on a user login.
 *
 * This powers the *active-log* on-ramp: imported plays are candidates shown in
 * the Rate tab's tray, never automatic diary entries (the user still taps Log).
 *
 * Docs: https://developer.spotify.com/documentation/web-api/reference/get-recently-played
 *       https://developer.spotify.com/documentation/web-api/reference/get-users-top-artists-and-tracks
 */

import {
  artistToSearchResult,
  trackToSearchResult,
  type SpotifyArtistObject,
  type SpotifyTrackObject,
} from './spotify';
// Type-only: keeps this module free of expo-auth-session at runtime so the
// unit tests (node) can import the parsers. The singleton wires the real auth
// in provider.ts.
import type { SpotifyUserAuth } from './spotify-auth';
import { MusicCatalogError, type SearchOptions, type SearchResult } from './types';

/** The slice of the auth session this library needs (injectable for tests). */
export type UserTokenSource = Pick<
  SpotifyUserAuth,
  'isConfigured' | 'isConnected' | 'connect' | 'disconnect' | 'getAccessToken'
>;

const API = 'https://api.spotify.com/v1';

/**
 * Same development-mode ceiling as search (see MAX_SEARCH_LIMIT in spotify.ts):
 * unapproved apps 400 on limits above 10, and 10 fills the tray fine.
 */
const MAX_LIMIT = 10;

/** GET /me/player/recently-played — play events, most recent first. */
interface SpotifyRecentlyPlayedResponse {
  items?: { track: SpotifyTrackObject; played_at?: string }[];
}

/** GET /me/top/tracks and /me/top/artists — bare paging objects. */
interface SpotifyTopTracksResponse {
  items?: SpotifyTrackObject[];
}
interface SpotifyTopArtistsResponse {
  items?: SpotifyArtistObject[];
}

/**
 * Pure: recently-played events → song results, most recent first, deduped by
 * track (the same song on repeat is one tray card, not five).
 */
export function parseRecentlyPlayed(json: SpotifyRecentlyPlayedResponse): SearchResult[] {
  const seen = new Set<string>();
  const results: SearchResult[] = [];
  for (const { track } of json.items ?? []) {
    if (!track?.id || seen.has(track.id)) continue;
    seen.add(track.id);
    results.push(trackToSearchResult(track));
  }
  return results;
}

/** Pure: top tracks → song results, in Spotify's affinity order (no re-sort). */
export function parseTopTracks(json: SpotifyTopTracksResponse): SearchResult[] {
  return (json.items ?? []).map(trackToSearchResult);
}

/** Pure: top artists → artist results, in Spotify's affinity order. */
export function parseTopArtists(json: SpotifyTopArtistsResponse): SearchResult[] {
  return (json.items ?? []).map(artistToSearchResult);
}

/**
 * What screens talk to. `connect`/`disconnect` are passed through from the
 * auth session so the UI needs exactly one import.
 */
export interface UserLibrary {
  /** Can this build offer a connect button at all (client ID configured)? */
  isConfigured(): boolean;
  /** Has the user connected Spotify on this device? */
  isConnected(): Promise<boolean>;
  /** Interactive login. True on success, false if dismissed. */
  connect(): Promise<boolean>;
  disconnect(): Promise<void>;
  /** Latest plays, most recent first, deduped by track. */
  getRecentlyPlayed(opts?: SearchOptions): Promise<SearchResult[]>;
  /** The user's top tracks (~last 4 weeks), for onboarding seeding. */
  getTopTracks(opts?: SearchOptions): Promise<SearchResult[]>;
  /** The user's top artists (~last 4 weeks), for taste-profile seeding. */
  getTopArtists(opts?: SearchOptions): Promise<SearchResult[]>;
}

export class SpotifyUserLibrary implements UserLibrary {
  /** Auth + fetch injectable so tests stay offline (same pattern as SpotifyCatalog). */
  constructor(
    private auth: UserTokenSource,
    private fetchImpl: typeof fetch = fetch.bind(globalThis),
  ) {}

  isConfigured(): boolean {
    return this.auth.isConfigured();
  }

  isConnected(): Promise<boolean> {
    return this.auth.isConnected();
  }

  connect(): Promise<boolean> {
    return this.auth.connect();
  }

  disconnect(): Promise<void> {
    return this.auth.disconnect();
  }

  private cap(limit: number | undefined): number {
    return Math.min(Math.max(1, limit ?? MAX_LIMIT), MAX_LIMIT);
  }

  /** GET a /me endpoint with the user token; MusicCatalogError on any failure. */
  private async get<T>(path: string, signal?: AbortSignal): Promise<T> {
    const token = await this.auth.getAccessToken();
    if (!token) {
      throw new MusicCatalogError('Connect Spotify to see your listening.');
    }
    const res = await this.fetchImpl(`${API}${path}`, {
      signal,
      headers: { Accept: 'application/json', Authorization: `Bearer ${token}` },
    }).catch((e: unknown) => {
      if ((e as Error)?.name === 'AbortError') throw e;
      throw new MusicCatalogError('Could not reach Spotify. Check your connection.');
    });
    if (res.status === 401 || res.status === 403) {
      // Token revoked or scope missing — force a clean reconnect.
      await this.auth.disconnect();
      throw new MusicCatalogError('Your Spotify connection expired. Connect again.');
    }
    if (!res.ok) {
      throw new MusicCatalogError(`Could not load your Spotify data (${res.status}).`);
    }
    return (await res.json()) as T;
  }

  async getRecentlyPlayed(opts: SearchOptions = {}): Promise<SearchResult[]> {
    const json = await this.get<SpotifyRecentlyPlayedResponse>(
      `/me/player/recently-played?limit=${this.cap(opts.limit)}`,
      opts.signal,
    );
    return parseRecentlyPlayed(json);
  }

  async getTopTracks(opts: SearchOptions = {}): Promise<SearchResult[]> {
    const json = await this.get<SpotifyTopTracksResponse>(
      `/me/top/tracks?time_range=short_term&limit=${this.cap(opts.limit)}`,
      opts.signal,
    );
    return parseTopTracks(json);
  }

  async getTopArtists(opts: SearchOptions = {}): Promise<SearchResult[]> {
    const json = await this.get<SpotifyTopArtistsResponse>(
      `/me/top/artists?time_range=short_term&limit=${this.cap(opts.limit)}`,
      opts.signal,
    );
    return parseTopArtists(json);
  }
}
