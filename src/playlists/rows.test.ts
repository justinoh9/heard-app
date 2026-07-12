import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  fromListItemRow,
  fromListRow,
  sortLists,
  toListItemRow,
  type ListItemRow,
  type ListRow,
} from './rows';
import type { Playlist, PlaylistSong } from './types';

const LIST_ROW: ListRow = {
  id: 'l1',
  user_id: 'u1',
  name: 'Late night',
  created_at: '2026-06-20T00:00:00.000Z',
};

const ITEM_ROWS: ListItemRow[] = [
  { list_id: 'l1', song_id: 's2', title: 'Snooze', artist: 'SZA', art_url: null, kind: 'song', position: 1 },
  { list_id: 'l1', song_id: 's1', title: 'Nights', artist: 'Frank Ocean', art_url: 'http://a/1.jpg', kind: 'song', position: 0 },
];

test('fromListRow folds items and orders them by position', () => {
  const list = fromListRow(LIST_ROW, ITEM_ROWS);
  assert.equal(list.id, 'l1');
  assert.equal(list.userId, 'u1');
  assert.equal(list.name, 'Late night');
  assert.deepEqual(list.songs.map((s) => s.id), ['s1', 's2']); // position 0 then 1
  assert.equal(list.songs[0].artUrl, 'http://a/1.jpg');
  assert.equal(list.songs[1].artUrl, undefined); // null → undefined
});

test('toListItemRow / fromListItemRow round-trip a song', () => {
  const song: PlaylistSong = { id: 's9', title: 'Nikes', artist: 'Frank Ocean', kind: 'song' };
  const row = toListItemRow('l1', song, 3);
  assert.equal(row.list_id, 'l1');
  assert.equal(row.position, 3);
  assert.equal(row.art_url, null);
  // Round-trip normalizes a missing artUrl to an explicit undefined.
  assert.deepEqual(fromListItemRow(row), { ...song, artUrl: undefined });
});

test('sortLists is newest-first, stable by id on ties', () => {
  const a: Playlist = { id: 'a', name: 'A', songs: [], createdAt: '2026-01-01T00:00:00.000Z' };
  const b: Playlist = { id: 'b', name: 'B', songs: [], createdAt: '2026-02-01T00:00:00.000Z' };
  const c: Playlist = { id: 'c', name: 'C', songs: [], createdAt: '2026-02-01T00:00:00.000Z' };
  assert.deepEqual(sortLists([a, b, c]).map((l) => l.id), ['b', 'c', 'a']);
});
