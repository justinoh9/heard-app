import assert from 'node:assert/strict';
import { test } from 'node:test';

import { hasSong, playlistCoverUrls, removeSongById, songCountLabel, upsertSong } from './helpers';
import type { Playlist, PlaylistSong } from './types';

const song = (id: string, artUrl?: string): PlaylistSong => ({
  id,
  title: `Song ${id}`,
  artist: 'Artist',
  artUrl,
  kind: 'song',
});

test('upsertSong appends new songs and dedupes by id', () => {
  const a = upsertSong([], song('1'));
  assert.equal(a.length, 1);
  const b = upsertSong(a, song('2'));
  assert.equal(b.length, 2);
  const c = upsertSong(b, song('1'));
  assert.equal(c.length, 2);
  assert.equal(c, b, 'returns the same array when nothing changes');
});

test('removeSongById removes the matching song immutably', () => {
  const list = [song('1'), song('2'), song('3')];
  const out = removeSongById(list, '2');
  assert.deepEqual(out.map((s) => s.id), ['1', '3']);
  assert.equal(list.length, 3, 'original is untouched');
});

test('hasSong reports membership', () => {
  const list = [song('1')];
  assert.equal(hasSong(list, '1'), true);
  assert.equal(hasSong(list, '9'), false);
});

test('playlistCoverUrls returns up to max distinct covers', () => {
  const pl: Playlist = {
    id: 'p',
    name: 'Mix',
    createdAt: '2026-01-01T00:00:00Z',
    songs: [song('1', 'a'), song('2', 'a'), song('3', 'b'), song('4'), song('5', 'c'), song('6', 'd'), song('7', 'e')],
  };
  // 'a' deduped, song('4') has no art; distinct: a, b, c, d -> capped at 4
  assert.deepEqual(playlistCoverUrls(pl), ['a', 'b', 'c', 'd']);
  assert.deepEqual(playlistCoverUrls(pl, 2), ['a', 'b']);
});

test('songCountLabel pluralizes', () => {
  assert.equal(songCountLabel(0), '0 songs');
  assert.equal(songCountLabel(1), '1 song');
  assert.equal(songCountLabel(5), '5 songs');
});
