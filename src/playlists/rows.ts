/**
 * Pure row ↔ model mapping for lists (0007_lists.sql), plus the newest-first
 * sort both backends share. Offline-testable, same split as
 * src/concerts/rows.ts and src/data/ratings-rows.ts.
 *
 * Note: `list_items` denormalizes the song's display fields (title/artist/art)
 * rather than FK-ing into `items`, so adding a search result to a list is a
 * single insert with no prior catalog cache — see the migration comment.
 */

import type { NewPlaylist, Playlist, PlaylistSong } from './types';

/** public.lists select/insert shape. */
export interface ListRow {
  id: string;
  user_id: string;
  name: string;
  created_at: string;
}

/** public.list_items select/insert shape. */
export interface ListItemRow {
  list_id: string;
  item_id: string;
  title: string;
  artist: string;
  art_url: string | null;
  kind: string;
  position: number;
}

export function toListRow(p: NewPlaylist): ListRow {
  return { id: p.id, user_id: p.userId, name: p.name, created_at: p.createdAt };
}

export function toListItemRow(
  listId: string,
  song: PlaylistSong,
  position: number,
): ListItemRow {
  return {
    list_id: listId,
    item_id: song.id,
    title: song.title,
    artist: song.artist,
    art_url: song.artUrl ?? null,
    kind: song.kind,
    position,
  };
}

export function fromListItemRow(row: ListItemRow): PlaylistSong {
  return {
    id: row.item_id,
    title: row.title,
    artist: row.artist,
    artUrl: row.art_url ?? undefined,
    kind: row.kind as PlaylistSong['kind'],
  };
}

/** Stitch a list row + its (unordered) item rows into a Playlist. */
export function fromListRows(list: ListRow, items: ListItemRow[]): Playlist {
  const songs = [...items]
    .sort((a, b) => a.position - b.position)
    .map(fromListItemRow);
  return {
    id: list.id,
    userId: list.user_id,
    name: list.name,
    songs,
    createdAt: list.created_at,
  };
}

/** Newest list first; ties broken by id so ordering is stable. */
export function sortPlaylists(playlists: Playlist[]): Playlist[] {
  return [...playlists].sort(
    (a, b) => b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id),
  );
}
