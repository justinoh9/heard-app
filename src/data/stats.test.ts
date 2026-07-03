/** Unit tests for the Wrapped stats rollup (offline, pure). */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type { RankedItem } from '@/ranking/types';
import type { Concert } from '@/concerts/types';
import { computeStats } from './stats';

const ranked = (id: string, artist: string, score: number, year?: string): RankedItem => ({
  item: { id, type: 'album', title: `T-${id}`, artist, year },
  score,
  tiebreak: 0,
});

const concert = (id: string, venue?: string): Concert => ({
  id,
  userId: 'u1',
  artistName: 'A',
  venue,
  showDate: '2026-01-01',
  taggedUserIds: [],
  createdAt: '2026-01-01T00:00:00.000Z',
});

describe('computeStats', () => {
  it('empty inputs produce zeroed, null-safe stats', () => {
    const s = computeStats([], []);
    assert.equal(s.ratedCount, 0);
    assert.equal(s.meanScore, null);
    assert.equal(s.highest, null);
    assert.equal(s.topVenue, null);
    assert.deepEqual(s.topArtists, []);
    assert.deepEqual(s.topDecades, []);
    assert.equal(s.histogram.length, 5);
    assert.ok(s.histogram.every((b) => b.count === 0));
  });

  it('mean, highest, and histogram bucket edges (10 lands in the top bucket)', () => {
    const s = computeStats(
      [ranked('a', 'X', 10), ranked('b', 'Y', 8), ranked('c', 'Z', 1.9)],
      [],
    );
    assert.equal(s.meanScore, 6.6);
    assert.equal(s.highest?.item.id, 'a');
    assert.deepEqual(
      s.histogram.map((b) => b.count),
      [1, 0, 0, 0, 2],
    );
  });

  it('top artists count multi-credits separately and sort by count then mean', () => {
    const s = computeStats(
      [
        ranked('a', 'Frank Ocean', 9),
        ranked('b', 'frank ocean', 8), // case-insensitive merge
        ranked('c', 'Kendrick Lamar, Frank Ocean', 10),
        ranked('d', 'Kendrick Lamar', 6),
        ranked('e', 'SZA', 9.5),
      ],
      [],
    );
    assert.equal(s.topArtists[0].name, 'Frank Ocean');
    assert.equal(s.topArtists[0].count, 3);
    assert.equal(s.topArtists[0].meanScore, 9);
    assert.equal(s.topArtists[1].name, 'Kendrick Lamar');
    assert.equal(s.topArtists[1].count, 2);
    // SZA (count 1) ranks by mean within its count tier.
    assert.equal(s.topArtists[2].name, 'SZA');
  });

  it('decades group by release year, newest first, unknown years dropped', () => {
    const s = computeStats(
      [
        ranked('a', 'X', 9, '2016'),
        ranked('b', 'Y', 8, '2012'),
        ranked('c', 'Z', 7, '2022'),
        ranked('d', 'W', 6), // unknown year
      ],
      [],
    );
    assert.deepEqual(s.topDecades, [
      { label: '2020s', count: 1 },
      { label: '2010s', count: 2 },
    ]);
  });

  it('concert count + most-visited venue', () => {
    const s = computeStats([], [
      concert('1', 'Red Rocks'),
      concert('2', 'Red Rocks'),
      concert('3', 'The Fillmore'),
      concert('4'),
    ]);
    assert.equal(s.concertCount, 4);
    assert.equal(s.topVenue, 'Red Rocks');
  });
});
