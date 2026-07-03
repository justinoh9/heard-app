/**
 * The active music catalog instance, in its own module so both the barrel
 * (index.ts) and the search hook can import it without a circular dependency.
 * Swapping providers is this one line — the `MusicCatalog` interface keeps the
 * screens unaware of which backend answers.
 */

import { SpotifyCatalog } from './spotify';
import { spotifyUserAuth } from './spotify-auth';
import { SpotifyUserLibrary, type UserLibrary } from './user-library';
import type { MusicCatalog } from './types';

export const musicCatalog: MusicCatalog = new SpotifyCatalog();

/**
 * The active user library (the viewer's own Spotify data). Lives here — not in
 * user-library.ts — because wiring the real auth session pulls expo-auth-session
 * into the module graph, which the node unit tests must not import.
 */
export const userLibrary: UserLibrary = new SpotifyUserLibrary(spotifyUserAuth);
