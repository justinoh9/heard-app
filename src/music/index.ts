/**
 * Public entry for the music catalog. Phase 4 UI imports `musicCatalog` and
 * the types from here — swapping the provider later is a one-line change.
 */

import { MusicBrainzCatalog } from './musicbrainz';
import type { MusicCatalog } from './types';

/** The active catalog. Swap for a SpotifyCatalog later (same interface). */
export const musicCatalog: MusicCatalog = new MusicBrainzCatalog();

export { coverArtUrl } from './musicbrainz';
export * from './types';
