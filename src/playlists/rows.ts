/**
 * Pure row ↔ model mapping for lists (0010_lists.sql) plus the newest-first
 * sort both backends share. Offline-testable, same split as
 * src/concerts/rows.ts and src/feed/rows.ts.
 */

import type { ItemType } from '@/ranking/types';

import type { Playlist, PlaylistSong } from './types';

/** public.lists select shape. */
export interface ListRow {
  id: string;
  user_id: string;
  name: string;
  created_at: string;
}

/** public.list_items select shape. */
export interface ListItemRow {
  list_id: string;
  song_id: string;
  title: string;
  artist: string;
  art_url: string | null;
  kind: string;
  position: number;
}

export function fromListItemRow(row: ListItemRow): PlaylistSong {
  return {
    id: row.song_id,
    title: row.title,
    artist: row.artist,
    artUrl: row.art_url ?? undefined,
    kind: row.kind as ItemType,
  };
}

export function toListItemRow(
  listId: string,
  song: PlaylistSong,
  position: number,
): ListItemRow {
  return {
    list_id: listId,
    song_id: song.id,
    title: song.title,
    artist: song.artist,
    art_url: song.artUrl ?? null,
    kind: song.kind,
    position,
  };
}

/** Fold a list row + its (position-ordered) item rows into a Playlist. */
export function fromListRow(row: ListRow, items: ListItemRow[]): Playlist {
  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    createdAt: row.created_at,
    songs: [...items].sort((a, b) => a.position - b.position).map(fromListItemRow),
  };
}

/** Newest list first; ties broken by id for a stable order. */
export function sortLists(lists: Playlist[]): Playlist[] {
  return [...lists].sort(
    (a, b) => b.createdAt.localeCompare(a.createdAt) || a.id.localeCompare(b.id),
  );
}
