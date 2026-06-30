/**
 * MusicBrainz catalog: searches release-groups (album-level entities) and
 * builds Cover Art Archive thumbnail URLs. No API key required.
 *
 * Docs: https://musicbrainz.org/doc/MusicBrainz_API
 *       https://wiki.musicbrainz.org/Cover_Art_Archive/API
 */

import {
  MusicCatalogError,
  type AlbumSearchResult,
  type MusicCatalog,
  type SearchOptions,
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
export function parseAlbumResults(json: MBSearchResponse): AlbumSearchResult[] {
  const groups = json['release-groups'] ?? [];
  const results: AlbumSearchResult[] = groups.map((rg) => ({
    id: rg.id,
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

export class MusicBrainzCatalog implements MusicCatalog {
  readonly provider = 'musicbrainz' as const;

  /**
   * fetch is injectable so tests don't hit the network. Bound to globalThis
   * because the browser's fetch throws "Illegal invocation" if called with any
   * other `this` (e.g. as a property of this instance).
   */
  constructor(private fetchImpl: typeof fetch = fetch.bind(globalThis)) {}

  async searchAlbums(query: string, opts: SearchOptions = {}): Promise<AlbumSearchResult[]> {
    const q = query.trim();
    if (!q) return [];

    const limit = opts.limit ?? 20;
    const url = `${API}/release-group?query=${encodeURIComponent(q)}&fmt=json&limit=${limit}`;

    const res = await this.fetchImpl(url, {
      signal: opts.signal,
      headers: { Accept: 'application/json', 'User-Agent': USER_AGENT },
    }).catch((e: unknown) => {
      // Let aborts propagate so callers can ignore them; wrap everything else.
      if ((e as Error)?.name === 'AbortError') throw e;
      throw new MusicCatalogError('Could not reach the music database. Check your connection.');
    });

    if (!res.ok) {
      throw new MusicCatalogError(`Music search failed (${res.status}).`);
    }

    const json = (await res.json()) as MBSearchResponse;
    return parseAlbumResults(json);
  }
}
