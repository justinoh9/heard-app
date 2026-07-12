/**
 * Music catalog seam. Screens (the search UIs) talk only to the `MusicCatalog`
 * interface, so the provider can change without touching them.
 *
 * Shipping now: the iTunes Search API (`src/music/itunes.ts`) — keyless, no
 * backend, working artwork + previews. Popularity (which iTunes lacks) is
 * layered on best-effort from Last.fm listener counts (`src/music/lastfm.ts`)
 * via the `PopularityEnricher` seam below. `src/music/spotify.ts` is retained
 * as an alternate provider (and still backs the user-library import); the
 * `provider` discriminant lets providers coexist.
 */

export type MusicProvider = 'musicbrainz' | 'spotify' | 'itunes';
/**
 * `artist` is a browse-only result (you navigate into its page, you don't rate
 * it), so comments/ratings never receive it in practice — see `src/comments`.
 */
export type SearchResultKind = 'album' | 'song' | 'artist';

export interface SearchResult {
  /** Provider-specific id (Spotify album/track/artist id). */
  id: string;
  kind: SearchResultKind;
  /** Album/song title, or the artist's name for artist-kind results. */
  title: string;
  /** Credited artist. Empty for artist-kind results (the name is in `title`). */
  artist: string;
  /** Release year, when known (e.g. "2023"). */
  year?: string;
  /** Cover/artist thumbnail URL. May be missing — UI falls back. */
  coverUrl?: string;
  /** "Album" | "EP" | "Single" | ... — album-kind only, lets the UI label or filter. */
  primaryType?: string;
  /** Primary genre when the provider has one (iTunes primaryGenreName). */
  genre?: string;
  /** Parent album title — song-kind only. */
  albumTitle?: string;
  /** 0-100 normalized popularity, when the provider has one. Spotify sets this on tracks. */
  popularity?: number;
  /**
   * 30-second preview MP3, when Spotify provides one. Banked for a future
   * tap-to-preview affordance; often null on newer apps (Spotify has been
   * deprecating `preview_url`), so treat it as best-effort.
   */
  previewUrl?: string;
  provider: MusicProvider;
}

/** One track in an album's tracklist (from getAlbumTracks). */
export interface AlbumTrack {
  id: string;
  title: string;
  /** 1-based position on the album. */
  trackNumber: number;
  /** Length in milliseconds. */
  durationMs: number;
  /** Credited artists, comma-joined. */
  artist: string;
  /** 30-second preview MP3, when the provider offers one (best-effort). */
  previewUrl?: string;
}

export interface SearchOptions {
  /** Max results to return. Default 20. */
  limit?: number;
  /** Abort an in-flight search (e.g. when the query changes). */
  signal?: AbortSignal;
}

/** Thrown for expected, user-facing failures (network down, bad status). */
export class MusicCatalogError extends Error {}

export interface MusicCatalog {
  readonly provider: MusicProvider;
  searchAlbums(query: string, opts?: SearchOptions): Promise<SearchResult[]>;
  searchTracks(query: string, opts?: SearchOptions): Promise<SearchResult[]>;
  /**
   * Everything at once — artists, songs, and albums — for the main search
   * surface (Spotify-style mixed results). Order: artists, then albums, then
   * songs; the UI groups by `kind`.
   */
  searchAll(query: string, opts?: SearchOptions): Promise<SearchResult[]>;
  /** An artist's albums + singles (albums first, newest first), for the artist page. */
  getArtistAlbums(artistId: string, opts?: SearchOptions): Promise<SearchResult[]>;
  /** An artist's popular songs (best-effort, relevance-ranked), for the artist page. */
  getArtistTopTracks(artistName: string, opts?: SearchOptions): Promise<SearchResult[]>;
  /** An album's tracklist, in album order, for the album's item page. */
  getAlbumTracks(albumId: string, opts?: SearchOptions): Promise<AlbumTrack[]>;
}

/**
 * Optional popularity layer. A catalog whose provider has no native popularity
 * signal (iTunes) can pass its song results through an enricher to attach a
 * 0-100 `popularity` and re-sort by it. Always best-effort: an enricher that
 * fails or can't match a track leaves that result's order untouched, so search
 * degrades to the catalog's own relevance rather than erroring.
 *
 * Receives songs only (the caller filters to song-kind results before calling),
 * and is expected to preserve the input order for anything it can't score.
 */
export interface PopularityEnricher {
  enrich(songs: SearchResult[], query: string, opts?: SearchOptions): Promise<SearchResult[]>;
}

/**
 * Optional artist-photo lookup. iTunes serves no artist artwork, so the artist
 * page fills its hero from a separate source (Deezer, src/music/deezer.ts).
 * Best-effort: resolves `undefined` when there's no match, and callers keep
 * their placeholder (the album-cover record player) rather than erroring.
 */
export interface ArtistImageProvider {
  getArtistImage(name: string, opts?: SearchOptions): Promise<string | undefined>;
}
