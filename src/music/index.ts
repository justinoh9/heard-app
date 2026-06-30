/**
 * Public entry for the music catalog. Phase 4 UI imports `musicCatalog`, the
 * search hook, and the types from here — swapping the provider later is a
 * one-line change in provider.ts.
 */

export { musicCatalog } from './provider';
export { coverArtUrl } from './musicbrainz';
export { useAlbumSearch, type AlbumSearchState } from './useAlbumSearch';
export * from './types';
