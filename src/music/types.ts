/**
 * Music catalog seam. Screens (Phase 4 search UI) talk only to the
 * `MusicCatalog` interface, so the provider can change without touching them.
 *
 * Shipping now: MusicBrainz (no API key, works client-side, has cover art).
 * Later: a Spotify catalog drops in behind the same interface (SPEC §7) once
 * there's a backend to hold the OAuth secret. Spotify search returns a mixed
 * track/album bag with a native popularity score — `SearchResult`'s `kind`
 * discriminant and optional `popularity` field exist so that swap doesn't
 * require reshaping call sites.
 */

export type MusicProvider = 'musicbrainz' | 'spotify';
export type SearchResultKind = 'album' | 'song';

export interface SearchResult {
  /** Provider-specific id (MusicBrainz release-group MBID for albums, recording MBID for songs). */
  id: string;
  kind: SearchResultKind;
  title: string;
  artist: string;
  /** Release year, when known (e.g. "2023"). */
  year?: string;
  /** Front cover thumbnail URL. May 404 if the release has no art — UI falls back. */
  coverUrl?: string;
  /** "Album" | "EP" | "Single" | ... — album-kind only, lets the UI label or filter. */
  primaryType?: string;
  /** Parent album title — song-kind only. */
  albumTitle?: string;
  /** 0-100 normalized popularity, when the provider has one. MusicBrainz never sets this. */
  popularity?: number;
  provider: MusicProvider;
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
  /** Combined album + song search, for surfaces that don't separate the two. */
  searchAll(query: string, opts?: SearchOptions): Promise<SearchResult[]>;
}
