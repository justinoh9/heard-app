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
  /** Parent album title — song-kind only. */
  albumTitle?: string;
  /** 0-100 normalized popularity, when the provider has one. Spotify sets this on tracks/artists. */
  popularity?: number;
  /** Spotify genre tags — artist-kind only. */
  genres?: string[];
  /** Total follower count — artist-kind only. */
  followers?: number;
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
  /**
   * Combined artist + album search (artists first), for the main search surface:
   * lets the user jump into an artist's page or rate an album from one query.
   */
  searchAlbumsAndArtists(query: string, opts?: SearchOptions): Promise<SearchResult[]>;
  /** Full artist detail (name, image, genres, followers) for the artist page header. */
  getArtist(artistId: string, opts?: SearchOptions): Promise<SearchResult>;
  /** An artist's albums + singles (albums first, newest first), for the artist page. */
  getArtistAlbums(artistId: string, opts?: SearchOptions): Promise<SearchResult[]>;
}
