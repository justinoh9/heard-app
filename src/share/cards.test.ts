import assert from 'node:assert/strict';
import { test } from 'node:test';

import { artistSpotlight, decadeSpotlight } from './cards';
import type { Item, RankedItem } from '@/ranking/types';

const item = (id: string, artist: string, year?: string): Item => ({
  id,
  type: 'album',
  title: id,
  artist,
  year,
});
const rated = (id: string, artist: string, score: number, year?: string): RankedItem => ({
  item: item(id, artist, year),
  score,
  tiebreak: 0,
});

test('artistSpotlight picks the most-rated artist and their best items first', () => {
  const spot = artistSpotlight([
    rated('a', 'Björk', 7),
    rated('b', 'Björk', 9),
    rated('c', 'Solo', 10),
  ]);
  assert.ok(spot);
  assert.equal(spot.title, 'Björk');
  assert.equal(spot.caption, '2 rated · 8.0 avg');
  assert.deepEqual(spot.items.map((m) => m.title), ['b', 'a']); // score order
});

test('artistSpotlight credits every artist in a multi-credit string', () => {
  const spot = artistSpotlight([
    rated('a', 'A, B', 8),
    rated('b', 'B', 6),
    rated('c', 'C', 10),
  ]);
  assert.ok(spot);
  assert.equal(spot.title, 'B'); // 2 credits beats C's higher score
});

test('artistSpotlight breaks count ties by mean score', () => {
  const spot = artistSpotlight([
    rated('a', 'Low', 5),
    rated('b', 'High', 9),
  ]);
  assert.ok(spot);
  assert.equal(spot.title, 'High');
});

test('artistSpotlight caps covers at four', () => {
  const spot = artistSpotlight(
    [1, 2, 3, 4, 5, 6].map((n) => rated(`t${n}`, 'Prolific', n)),
  );
  assert.ok(spot);
  assert.equal(spot.items.length, 4);
  assert.equal(spot.items[0].score, 6); // best first
});

test('artistSpotlight is null on an empty list', () => {
  assert.equal(artistSpotlight([]), null);
});

test('decadeSpotlight picks the most-rated decade, newer on a tie', () => {
  const spot = decadeSpotlight([
    rated('a', 'x', 8, '1991'),
    rated('b', 'x', 7, '1995'),
    rated('c', 'x', 9, '2011'),
  ]);
  assert.ok(spot);
  assert.equal(spot.title, '1990s');
  assert.equal(spot.caption, '2 rated · 7.5 avg');

  const tie = decadeSpotlight([rated('a', 'x', 8, '1991'), rated('b', 'x', 9, '2011')]);
  assert.ok(tie);
  assert.equal(tie.title, '2010s');
});

test('decadeSpotlight drops unparseable years and is null without any', () => {
  const spot = decadeSpotlight([rated('a', 'x', 8, 'soon'), rated('b', 'x', 9, '1999')]);
  assert.ok(spot);
  assert.equal(spot.title, '1990s');
  assert.equal(spot.items.length, 1);

  assert.equal(decadeSpotlight([rated('a', 'x', 8)]), null);
});
