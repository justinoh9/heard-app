/**
 * The active music catalog instance, in its own module so both the barrel
 * (index.ts) and the search hook can import it without a circular dependency.
 * Swap for a SpotifyCatalog later (same interface).
 */

import { MusicBrainzCatalog } from './musicbrainz';
import type { MusicCatalog } from './types';

export const musicCatalog: MusicCatalog = new MusicBrainzCatalog();
