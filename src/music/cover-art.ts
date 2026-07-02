/**
 * Cover Art Archive URL builder. Kept separate from the live search provider on
 * purpose: it's only used by the mock seed data (`src/data/catalog.ts`,
 * `src/playlists/seed.ts`), which references stable MusicBrainz release-group
 * MBIDs for their art. Real search now runs through Spotify (`src/music/spotify.ts`);
 * seed covers stay on the Cover Art Archive because those URLs need no API key
 * and don't rot the way a hard-coded Spotify CDN link would.
 *
 * Docs: https://wiki.musicbrainz.org/Cover_Art_Archive/API
 */

const COVER_ART = 'https://coverartarchive.org';

/** Front-cover URL for a MusicBrainz release-group. Size is the max edge in px. */
export function coverArtUrl(releaseGroupId: string, size: 250 | 500 | 1200 = 250): string {
  return `${COVER_ART}/release-group/${releaseGroupId}/front-${size}`;
}
