/**
 * MusicBrainz catalog: searches release-groups (album-level entities) and
 * recordings (song-level entities), and builds Cover Art Archive thumbnail
 * URLs. No API key required.
 *
 * Docs: https://musicbrainz.org/doc/MusicBrainz_API
 *       https://wiki.musicbrainz.org/Cover_Art_Archive/API
 */

import {
  MusicCatalogError,
  type MusicCatalog,
  type SearchOptions,
  type SearchResult,
} from './types';

const API = 'https://musicbrainz.org/ws/2';
const COVER_ART = 'https://coverartarchive.org';

/**
 * MusicBrainz asks every client to identify itself. Browsers forbid setting
 * User-Agent (it's dropped silently there), but native platforms send it.
 */
const USER_AGENT = 'Heard/0.1 ( https://github.com/justinoh9/heard-app )';

interface MBArtistCredit {
  name: string;
  joinphrase?: string;
}

interface MBReleaseGroup {
  id: string;
  title: string;
  'primary-type'?: string;
  'first-release-date'?: string;
  'artist-credit'?: MBArtistCredit[];
}

interface MBSearchResponse {
  'release-groups'?: MBReleaseGroup[];
}

interface MBRelease {
  id: string;
  'release-group'?: { id: string };
}

interface MBRecording {
  id: string;
  title: string;
  'first-release-date'?: string;
  'artist-credit'?: MBArtistCredit[];
  releases?: MBRelease[];
}

interface MBRecordingSearchResponse {
  recordings?: MBRecording[];
}

/** Front-cover URL for a release-group. Size is the max edge in px. */
export function coverArtUrl(releaseGroupId: string, size: 250 | 500 | 1200 = 250): string {
  return `${COVER_ART}/release-group/${releaseGroupId}/front-${size}`;
}

function creditToArtist(credit?: MBArtistCredit[]): string {
  if (!credit?.length) return 'Unknown artist';
  return credit.map((c) => `${c.name}${c.joinphrase ?? ''}`).join('').trim();
}

/**
 * Pure: map a MusicBrainz release-group search response to album results.
 * Separated from the fetch so it can be unit-tested offline.
 */
export function parseAlbumResults(json: MBSearchResponse): SearchResult[] {
  const groups = json['release-groups'] ?? [];
  const results: SearchResult[] = groups.map((rg) => ({
    id: rg.id,
    kind: 'album',
    title: rg.title,
    artist: creditToArtist(rg['artist-credit']),
    year: rg['first-release-date']?.slice(0, 4) || undefined,
    coverUrl: coverArtUrl(rg.id),
    primaryType: rg['primary-type'],
    provider: 'musicbrainz',
  }));
  // Album-first: surface full albums before EPs/singles.
  return results.sort(
    (a, b) => (a.primaryType === 'Album' ? 0 : 1) - (b.primaryType === 'Album' ? 0 : 1),
  );
}

/**
 * Pure: map a MusicBrainz recording search response to song results.
 * A recording can appear on several releases (singles, album versions,
 * remasters) — we take the first release's release-group for cover art and
 * album title, since recordings have no art of their own in Cover Art
 * Archive. Recordings with zero releases get no cover and no album title.
 */
export function parseTrackResults(json: MBRecordingSearchResponse): SearchResult[] {
  const recordings = json.recordings ?? [];
  return recordings.map((rec) => {
    const releaseGroupId = rec.releases?.[0]?.['release-group']?.id;
    return {
      id: rec.id,
      kind: 'song',
      title: rec.title,
      artist: creditToArtist(rec['artist-credit']),
      year: rec['first-release-date']?.slice(0, 4) || undefined,
      coverUrl: releaseGroupId ? coverArtUrl(releaseGroupId) : undefined,
      provider: 'musicbrainz',
    };
  });
}

export class MusicBrainzCatalog implements MusicCatalog {
  readonly provider = 'musicbrainz' as const;

  /**
   * fetch is injectable so tests don't hit the network. Bound to globalThis
   * because the browser's fetch throws "Illegal invocation" if called with any
   * other `this` (e.g. as a property of this instance).
   */
  constructor(private fetchImpl: typeof fetch = fetch.bind(globalThis)) {}

  private async request<T>(endpoint: string, query: string, limit: number, signal?: AbortSignal): Promise<T> {
    const url = `${API}/${endpoint}?query=${encodeURIComponent(query)}&fmt=json&limit=${limit}`;
    const res = await this.fetchImpl(url, {
      signal,
      headers: { Accept: 'application/json', 'User-Agent': USER_AGENT },
    }).catch((e: unknown) => {
      // Let aborts propagate so callers can ignore them; wrap everything else.
      if ((e as Error)?.name === 'AbortError') throw e;
      throw new MusicCatalogError('Could not reach the music database. Check your connection.');
    });

    if (!res.ok) {
      throw new MusicCatalogError(`Music search failed (${res.status}).`);
    }
    return (await res.json()) as T;
  }

  async searchAlbums(query: string, opts: SearchOptions = {}): Promise<SearchResult[]> {
    const q = query.trim();
    if (!q) return [];
    // NOTE (deferred to SpotifyCatalog): two known search gaps can't be fixed
    // here. (1) Artist-name searches surface unrelated releases that merely
    // share the title; (2) results can't be ranked by popularity because
    // MusicBrainz has no popularity signal (relevance scores tie at 100 and
    // order is arbitrary, so bootlegs/unreleased editions float to the top).
    // Spotify's search solves both natively — see SPEC §7.
    const json = await this.request<MBSearchResponse>('release-group', q, opts.limit ?? 20, opts.signal);
    return parseAlbumResults(json);
  }

  async searchTracks(query: string, opts: SearchOptions = {}): Promise<SearchResult[]> {
    const q = query.trim();
    if (!q) return [];
    // NOTE: recording search is noisier than release-group search — the same
    // artist-name and no-popularity gaps as searchAlbums apply, plus
    // MusicBrainz often has many duplicate masters/regional releases/live
    // versions per song with no way to pick a "canonical" one. No fix
    // available before a real Spotify catalog.
    const json = await this.request<MBRecordingSearchResponse>(
      'recording',
      q,
      opts.limit ?? 20,
      opts.signal,
    );
    return parseTrackResults(json);
  }

  async searchAll(query: string, opts: SearchOptions = {}): Promise<SearchResult[]> {
    // MusicBrainz has no native mixed search — fire both endpoints concurrently.
    const [albums, tracks] = await Promise.all([
      this.searchAlbums(query, opts),
      this.searchTracks(query, opts),
    ]);
    return [...albums, ...tracks];
  }
}
