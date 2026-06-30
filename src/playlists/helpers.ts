/**
 * Pure, immutable helpers for playlist song lists. Framework-free so they run
 * under the `tsx` node test runner like the ranking/social/comment helpers.
 */

import type { Playlist, PlaylistSong } from './types';

/** Append a song, ignoring duplicates (by id). Returns a new array. */
export function upsertSong(songs: PlaylistSong[], song: PlaylistSong): PlaylistSong[] {
  if (songs.some((s) => s.id === song.id)) return songs;
  return [...songs, song];
}

/** Remove a song by id. Returns a new array. */
export function removeSongById(songs: PlaylistSong[], id: string): PlaylistSong[] {
  return songs.filter((s) => s.id !== id);
}

export function hasSong(songs: PlaylistSong[], id: string): boolean {
  return songs.some((s) => s.id === id);
}

/** Up to `max` distinct cover URLs for a collage thumbnail. */
export function playlistCoverUrls(playlist: Playlist, max = 4): string[] {
  const urls: string[] = [];
  for (const s of playlist.songs) {
    if (s.artUrl && !urls.includes(s.artUrl)) urls.push(s.artUrl);
    if (urls.length >= max) break;
  }
  return urls;
}

export function songCountLabel(n: number): string {
  return `${n} ${n === 1 ? 'song' : 'songs'}`;
}
