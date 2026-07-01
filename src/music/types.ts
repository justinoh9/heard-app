/**
 * Music catalog seam. Screens (the search UIs) talk only to the `MusicCatalog`
 * interface, so the provider can change without touching them.
 *
 * Shipping now: Spotify (`src/music/spotify.ts`), which gives real popularity
 * ranking and a mixed album/track search in a single request. It needs a
 * client secret, embedded here via `EXPO_PUBLIC_*` for lack of a backend — see
 * the SECURITY note in `spotify.ts`. The `musicbrainz`/`spotify` provider
 * discriminant is kept so a second provider (e.g. Apple Music) could coexist.
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
