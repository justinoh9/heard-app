/** Unit tests for list row mapping + stitching (offline). */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  fromListRows,
  sortPlaylists,
  toListItemRow,
  toListRow,
  type ListItemRow,
  type ListRow,
} from './rows';
import type { NewPlaylist, Playlist, PlaylistSong } from './types';

const listRow: ListRow = {
  id: 'l1',
  user_id: 'u1',
  name: 'Late night',
  created_at: '2026-07-01T00:00:00.000Z',
};

const song = (over: Partial<PlaylistSong>): PlaylistSong => ({
  id: 's',
  title: 'Nights',
  artist: 'Frank Ocean',
  artUrl: 'http://art/nights.jpg',
  kind: 'song',
  ...over,
});

const playlist = (over: Partial<Playlist>): Playlist => ({
  id: 'x',
  userId: 'u1',
  name: 'L',
  songs: [],
  createdAt: '2026-01-01T00:00:00.000Z',
  ...over,
});

describe('list rows', () => {
  it('toListRow / toListItemRow map a new list and its songs to insert shape', () => {
    const draft: NewPlaylist = { id: 'l1', userId: 'u1', name: 'Late night', createdAt: listRow.created_at };
    assert.deepEqual(toListRow(draft), listRow);

    const row = toListItemRow('l1', song({ id: 'nights' }), 2);
    assert.equal(row.list_id, 'l1');
    assert.equal(row.item_id, 'nights');
    assert.equal(row.position, 2);
    assert.equal(row.art_url, 'http://art/nights.jpg');
    assert.equal(row.kind, 'song');
  });

  it('toListItemRow maps a missing cover to null', () => {
    assert.equal(toListItemRow('l1', song({ artUrl: undefined }), 0).art_url, null);
  });

  it('fromListRows orders songs by position, nullable art becomes undefined', () => {
    const items: ListItemRow[] = [
      { list_id: 'l1', item_id: 'b', title: 'B', artist: 'x', art_url: null, kind: 'song', position: 1 },
      { list_id: 'l1', item_id: 'a', title: 'A', artist: 'x', art_url: 'http://a', kind: 'song', position: 0 },
    ];
    const p = fromListRows(listRow, items);
    assert.equal(p.name, 'Late night');
    assert.equal(p.userId, 'u1');
    assert.deepEqual(p.songs.map((s) => s.id), ['a', 'b']);
    assert.equal(p.songs[1].artUrl, undefined);
  });

  it('sortPlaylists is newest first, id breaking timestamp ties', () => {
    const a = playlist({ id: 'a', createdAt: '2026-05-01T00:00:00Z' });
    const b = playlist({ id: 'b', createdAt: '2026-06-01T00:00:00Z' });
    const c = playlist({ id: 'c', createdAt: '2026-06-01T00:00:00Z' });
    assert.deepEqual(sortPlaylists([a, b, c]).map((x) => x.id), ['c', 'b', 'a']);
  });
});
