/**
 * The active music catalog instance, in its own module so both the barrel
 * (index.ts) and the search hook can import it without a circular dependency.
 * Swapping providers is this one line — the `MusicCatalog` interface keeps the
 * screens unaware of which backend answers.
 */

import { DeezerArtistImages } from './deezer';
import { deezerRequest } from './deezer-request';
import { ITunesCatalog } from './itunes';
import { LastfmEnricher } from './lastfm';
import { spotifyUserAuth } from './spotify-auth';
import { SpotifyUserLibrary, type UserLibrary } from './user-library';
import type { ArtistImageProvider, MusicCatalog } from './types';

// iTunes powers search (keyless, no backend). Last.fm layers on a popularity
// ranking when EXPO_PUBLIC_LASTFM_API_KEY is set; without it, results keep
// Apple's relevance order. Swapping providers stays a one-line change here.
const enricher = process.env.EXPO_PUBLIC_LASTFM_API_KEY ? new LastfmEnricher() : null;
export const musicCatalog: MusicCatalog = new ITunesCatalog(undefined, enricher);

/**
 * Artist photos (which iTunes lacks) come from Deezer, via the JSONP/fetch
 * transport that sidesteps its browser-CORS block. Used by the artist page hero.
 */
export const artistImages: ArtistImageProvider = new DeezerArtistImages(deezerRequest);

/**
 * The active user library (the viewer's own Spotify data). Lives here — not in
 * user-library.ts — because wiring the real auth session pulls expo-auth-session
 * into the module graph, which the node unit tests must not import.
 */
export const userLibrary: UserLibrary = new SpotifyUserLibrary(spotifyUserAuth);
