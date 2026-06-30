/**
 * Music catalog seam. Screens (Phase 4 search UI) talk only to the
 * `MusicCatalog` interface, so the provider can change without touching them.
 *
 * Shipping now: MusicBrainz (no API key, works client-side, has cover art).
 * Later: a Spotify catalog drops in behind the same interface (SPEC §7) once
 * there's a backend to hold the OAuth secret.
 */

export type MusicProvider = 'musicbrainz' | 'spotify';

export interface AlbumSearchResult {
  /** Provider-specific id (MusicBrainz release-group MBID). */
  id: string;
  title: string;
  artist: string;
  /** Release year, when known (e.g. "2023"). */
  year?: string;
  /** Front cover thumbnail URL. May 404 if the release has no art — UI falls back. */
  coverUrl?: string;
  /** "Album" | "EP" | "Single" | ... — lets the UI label or filter. */
  primaryType?: string;
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
  searchAlbums(query: string, opts?: SearchOptions): Promise<AlbumSearchResult[]>;
}
