/**
 * The active music catalog instance, in its own module so both the barrel
 * (index.ts) and the search hook can import it without a circular dependency.
 * Swapping providers is this one line — the `MusicCatalog` interface keeps the
 * screens unaware of which backend answers.
 */

import { SpotifyCatalog } from './spotify';
import type { MusicCatalog } from './types';

export const musicCatalog: MusicCatalog = new SpotifyCatalog();
