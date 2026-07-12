import assert from 'node:assert/strict';
import { test } from 'node:test';

import { defaultListType, rankedOfType, typeCounts } from './lists';
import type { Item, ItemType, RankedItem } from './types';

const item = (id: string, type: ItemType): Item => ({ id, type, title: id, artist: 'x' });
const rated = (id: string, type: ItemType, score: number, tiebreak = 0): RankedItem => ({
  item: item(id, type),
  score,
  tiebreak,
});

const LIST: RankedItem[] = [
  rated('a1', 'album', 9.0),
  rated('s1', 'song', 8.0),
  rated('a2', 'album', 9.0, 1), // ties a1's score; higher tiebreak ranks first
  rated('s2', 'song', 9.5),
];

test('rankedOfType filters to one type and sorts (score desc, tiebreak desc)', () => {
  assert.deepEqual(
    rankedOfType(LIST, 'album').map((r) => r.item.id),
    ['a2', 'a1'],
  );
  assert.deepEqual(
    rankedOfType(LIST, 'song').map((r) => r.item.id),
    ['s2', 's1'],
  );
});

test('typeCounts tallies albums and songs', () => {
  assert.deepEqual(typeCounts(LIST), { album: 2, song: 2 });
  assert.deepEqual(typeCounts([]), { album: 0, song: 0 });
});

test('defaultListType prefers the larger list, albums on a tie', () => {
  assert.equal(defaultListType(LIST), 'album'); // 2 vs 2 → album
  assert.equal(defaultListType([rated('s', 'song', 8)]), 'song');
  assert.equal(defaultListType([]), 'album');
});
