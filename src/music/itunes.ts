/**
 * iTunes Search API catalog. Keyless and backend-free: every method is a plain
 * GET against `itunes.apple.com` — no token, no client secret, no proxy. It
 * returns real artwork (upscalable from the 100px thumbnail) and *working* 30s
 * previews, which is why we moved off Spotify here (Spotify has been
 * deprecating `preview_url`, and its search needs an embedded secret).
 *
 * The one thing iTunes lacks is a popularity signal. That's layered on
 * best-effort by an optional `PopularityEnricher` (Last.fm listener counts, see
 * src/music/lastfm.ts): search results are enriched and re-ranked when a key is
 * configured, and fall back to Apple's relevance order when it isn't.
 *
 * Docs: https://performance-partners.apple.com/search-api
 *   search: /search?term=&media=music&entity=song|album&limit=
 *   lookup: /lookup?id=&entity=album|song   (artist's albums, album's tracks)
 *
 * Ids are numeric (artistId / collectionId / trackId), a different namespace
 * from the old Spotify ids — the `provider` discriminant keeps them distinct.
 */

import {
  MusicCatalogError,
  type AlbumTrack,
  type MusicCatalog,
  type PopularityEnricher,
  type SearchOptions,
  type SearchResult,
} from './types';

const API = 'https://itunes.apple.com';

/** Default page size; iTunes caps at 200 but a search list wants far fewer. */
const DEFAULT_LIMIT = 20;

/** One entry from a search/lookup response. Fields vary by `wrapperType`. */
export interface ITunesEntity {
  wrapperType?: string; // 'track' | 'collection' | 'artist'
  kind?: string; // 'song', 'music-video', … (track wrappers only)
  artistId?: number;
  artistName?: string;
  collectionId?: number;
  collectionName?: string;
  collectionType?: string; // 'Album', 'Compilation', …
  trackId?: number;
  trackName?: string;
  trackNumber?: number;
  trackCount?: number;
  trackTimeMillis?: number;
  artworkUrl100?: string;
  artworkUrl60?: string;
  releaseDate?: string; // ISO 8601
  previewUrl?: string;
  primaryGenreName?: string; // e.g. "Hip-Hop/Rap", "Alternative"
}

interface ITunesResponse {
  resultCount?: number;
  results?: ITunesEntity[];
}

function clampLimit(limit: number | undefined): number {
  return Math.min(Math.max(1, Math.floor(limit ?? DEFAULT_LIMIT)), 200);
}

function year(releaseDate?: string): string | undefined {
  return releaseDate ? releaseDate.slice(0, 4) : undefined;
}

/**
 * Pure: upscale an iTunes artwork URL. Apple returns `.../100x100bb.jpg`; the
 * dimensions are just a path segment, so swapping them yields a crisp cover.
 * Returns the input unchanged if it isn't the expected shape (or is missing).
 */
export function upscaleArtwork(url: string | undefined, size = 600): string | undefined {
  if (!url) return undefined;
  return url.replace(/\/\d+x\d+bb\./, `/${size}x${size}bb.`);
}

/** Pure: a collection entity → an album SearchResult. */
export function albumToResult(e: ITunesEntity): SearchResult {
  return {
    id: String(e.collectionId),
    kind: 'album',
    title: e.collectionName ?? 'Untitled',
    artist: e.artistName ?? 'Unknown artist',
    year: year(e.releaseDate),
    coverUrl: upscaleArtwork(e.artworkUrl100),
    primaryType: e.collectionType ?? 'Album',
    genre: e.primaryGenreName || undefined,
    provider: 'itunes',
  };
}

/** Pure: a track entity → a song SearchResult. */
export function trackToResult(e: ITunesEntity): SearchResult {
  return {
    id: String(e.trackId),
    kind: 'song',
    title: e.trackName ?? 'Untitled',
    artist: e.artistName ?? 'Unknown artist',
    year: year(e.releaseDate),
    coverUrl: upscaleArtwork(e.artworkUrl100),
    albumTitle: e.collectionName,
    previewUrl: e.previewUrl,
    genre: e.primaryGenreName || undefined,
    provider: 'itunes',
  };
}

/**
 * Pure: an entity carrying artist fields → an artist SearchResult (name in
 * `title`). iTunes serves no artist artwork, so `coverUrl` is left undefined
 * and the UI falls back to its artist placeholder.
 */
export function artistToResult(e: ITunesEntity): SearchResult {
  return {
    id: String(e.artistId),
    kind: 'artist',
    title: e.artistName ?? 'Unknown artist',
    artist: '',
    provider: 'itunes',
  };
}

function isCollection(e: ITunesEntity): boolean {
  return e.wrapperType === 'collection' || (e.collectionId != null && e.trackId == null);
}

function isSong(e: ITunesEntity): boolean {
  // Exclude music videos and other non-song track kinds.
  return e.wrapperType === 'track' && (e.kind === undefined || e.kind === 'song');
}

/** Pure: album results from a response, deduped by collection id. */
export function parseAlbums(json: ITunesResponse): SearchResult[] {
  const seen = new Set<string>();
  const out: SearchResult[] = [];
  for (const e of json.results ?? []) {
    if (!isCollection(e) || e.collectionId == null) continue;
    const id = String(e.collectionId);
    if (seen.has(id)) continue;
    seen.add(id);
    out.push(albumToResult(e));
  }
  return out;
}

/** Pure: song results from a response, deduped by track id. */
export function parseTracks(json: ITunesResponse): SearchResult[] {
  const seen = new Set<string>();
  const out: SearchResult[] = [];
  for (const e of json.results ?? []) {
    if (!isSong(e) || e.trackId == null) continue;
    const id = String(e.trackId);
    if (seen.has(id)) continue;
    seen.add(id);
    out.push(trackToResult(e));
  }
  return out;
}

/**
 * Pure: unique artist rows derived from any entities that carry an artistId.
 * iTunes' mixed search doesn't return standalone artist objects with art, so we
 * synthesize navigable artist rows from the albums/tracks a query surfaced —
 * their `artistId` is all the artist page needs to load a discography.
 *
 * Ordered by how many hits reference each artist (descending). iTunes has no
 * popularity signal, so this frequency is our relevance proxy: the artist the
 * user meant recurs across their catalog, while an incidental collaborator or
 * same-titled release shows up once — this keeps the intended artist on top
 * (and thus in the "Top result" slot) instead of whatever the API returned first.
 */
export function deriveArtists(entities: ITunesEntity[]): SearchResult[] {
  const acc = new Map<string, { entity: ITunesEntity; count: number; order: number }>();
  let order = 0;
  for (const e of entities) {
    if (e.artistId == null || !e.artistName) continue;
    const id = String(e.artistId);
    const existing = acc.get(id);
    if (existing) existing.count += 1;
    else acc.set(id, { entity: e, count: 1, order: order++ });
  }
  return [...acc.values()]
    .sort((a, b) => b.count - a.count || a.order - b.order) // ties keep first-seen order
    .map(({ entity }) => artistToResult(entity));
}

/**
 * Pure: album's tracklist in album order. A `lookup?entity=song` response leads
 * with the collection wrapper (dropped here), then its songs.
 */
export function parseAlbumTracks(json: ITunesResponse): AlbumTrack[] {
  return (json.results ?? [])
    .filter((e) => isSong(e) && e.trackId != null)
    .map((e, i) => ({
      id: String(e.trackId),
      title: e.trackName ?? 'Untitled',
      trackNumber: e.trackNumber ?? i + 1,
      durationMs: e.trackTimeMillis ?? 0,
      artist: e.artistName ?? 'Unknown artist',
    }))
    .sort((a, b) => a.trackNumber - b.trackNumber);
}

/** Pure: an artist's albums (from lookup), newest first. */
export function parseArtistAlbums(json: ITunesResponse): SearchResult[] {
  return parseAlbums(json).sort((a, b) => (b.year ?? '').localeCompare(a.year ?? ''));
}

export class ITunesCatalog implements MusicCatalog {
  readonly provider = 'itunes' as const;

  /**
   * `fetchImpl` is injectable so tests don't hit the network (bound to
   * globalThis — the browser's fetch throws "Illegal invocation" otherwise).
   * `enricher` is optional; when present, song results are popularity-ranked.
   */
  constructor(
    private fetchImpl: typeof fetch = fetch.bind(globalThis),
    private enricher: PopularityEnricher | null = null,
  ) {}

  private async get(path: string, signal?: AbortSignal): Promise<ITunesResponse> {
    const res = await this.fetchImpl(`${API}${path}`, {
      signal,
      headers: { Accept: 'application/json' },
    }).catch((e: unknown) => {
      if ((e as Error)?.name === 'AbortError') throw e;
      throw new MusicCatalogError('Could not reach the music catalog. Check your connection.');
    });
    if (!res.ok) {
      throw new MusicCatalogError(`Music search failed (${res.status}).`);
    }
    return (await res.json()) as ITunesResponse;
  }

  /** Run song results through the popularity enricher, if one is configured. */
  private async rank(songs: SearchResult[], query: string, opts: SearchOptions): Promise<SearchResult[]> {
    if (!this.enricher || songs.length === 0) return songs;
    return this.enricher.enrich(songs, query, opts);
  }

  async searchAlbums(query: string, opts: SearchOptions = {}): Promise<SearchResult[]> {
    const q = query.trim();
    if (!q) return [];
    const path = `/search?term=${encodeURIComponent(q)}&media=music&entity=album&limit=${clampLimit(opts.limit)}`;
    return parseAlbums(await this.get(path, opts.signal));
  }

  async searchTracks(query: string, opts: SearchOptions = {}): Promise<SearchResult[]> {
    const q = query.trim();
    if (!q) return [];
    const path = `/search?term=${encodeURIComponent(q)}&media=music&entity=song&limit=${clampLimit(opts.limit)}`;
    const songs = parseTracks(await this.get(path, opts.signal));
    return this.rank(songs, q, opts);
  }

  async searchAll(query: string, opts: SearchOptions = {}): Promise<SearchResult[]> {
    const q = query.trim();
    if (!q) return [];
    const limit = clampLimit(opts.limit);
    // Two parallel requests (albums + songs); artists are derived from both, so
    // no third round-trip. Order mirrors the old catalog: artists, albums, songs.
    const [albumJson, songJson] = await Promise.all([
      this.get(`/search?term=${encodeURIComponent(q)}&media=music&entity=album&limit=${limit}`, opts.signal),
      this.get(`/search?term=${encodeURIComponent(q)}&media=music&entity=song&limit=${limit}`, opts.signal),
    ]);
    const artists = deriveArtists([...(albumJson.results ?? []), ...(songJson.results ?? [])]);
    const albums = parseAlbums(albumJson);
    const songs = await this.rank(parseTracks(songJson), q, opts);
    return [...artists, ...albums, ...songs];
  }

  async getArtistAlbums(artistId: string, opts: SearchOptions = {}): Promise<SearchResult[]> {
    const id = artistId.trim();
    if (!id) return [];
    const path = `/lookup?id=${encodeURIComponent(id)}&entity=album&limit=${clampLimit(opts.limit)}`;
    return parseArtistAlbums(await this.get(path, opts.signal));
  }

  async getArtistTopTracks(artistName: string, opts: SearchOptions = {}): Promise<SearchResult[]> {
    const name = artistName.trim();
    if (!name) return [];
    // No artist id here (the interface passes a name), so approximate popular
    // songs with a name-scoped song search — iTunes' relevance surfaces the
    // artist's hits first. Left un-enriched: the query is an artist, not a
    // track, so Last.fm's track.search wouldn't line up cleanly.
    const path = `/search?term=${encodeURIComponent(name)}&media=music&entity=song&limit=${clampLimit(opts.limit)}`;
    return parseTracks(await this.get(path, opts.signal));
  }

  async getAlbumTracks(albumId: string, opts: SearchOptions = {}): Promise<AlbumTrack[]> {
    const id = albumId.trim();
    if (!id) return [];
    const path = `/lookup?id=${encodeURIComponent(id)}&entity=song&limit=${Math.min(opts.limit ?? 200, 200)}`;
    return parseAlbumTracks(await this.get(path, opts.signal));
  }
}
