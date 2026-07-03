/** Unit tests for concert row mapping + attendance filtering (offline). */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { concertsFor, fromConcertRow, sortConcerts, toConcertRow, type ConcertRow } from './rows';
import type { Concert } from './types';

const row: ConcertRow = {
  id: 'c1',
  user_id: 'u1',
  artist_name: 'Tame Impala',
  artist_id: null,
  venue: 'Red Rocks',
  city: 'Morrison',
  show_date: '2026-06-30',
  score: 9.5,
  notes: null,
  created_at: '2026-07-01T00:00:00.000Z',
};

const concert = (over: Partial<Concert>): Concert => ({
  id: 'x',
  userId: 'u1',
  artistName: 'A',
  showDate: '2026-01-01',
  taggedUserIds: [],
  createdAt: '2026-01-01T00:00:00.000Z',
  ...over,
});

describe('concert rows', () => {
  it('fromConcertRow maps nullables to undefined and attaches tags', () => {
    const c = fromConcertRow(row, ['u2']);
    assert.equal(c.artistName, 'Tame Impala');
    assert.equal(c.venue, 'Red Rocks');
    assert.equal(c.artistId, undefined);
    assert.equal(c.notes, undefined);
    assert.equal(c.score, 9.5);
    assert.deepEqual(c.taggedUserIds, ['u2']);
  });

  it('toConcertRow round-trips with fromConcertRow', () => {
    const c = fromConcertRow(row, []);
    const back = toConcertRow(c);
    assert.equal(back.artist_name, row.artist_name);
    assert.equal(back.venue, row.venue);
    assert.equal(back.artist_id, null);
    assert.equal(back.show_date, row.show_date);
  });

  it('sortConcerts is newest show first, log time breaking date ties', () => {
    const a = concert({ id: 'a', showDate: '2026-05-01' });
    const b = concert({ id: 'b', showDate: '2026-06-01' });
    const c1 = concert({ id: 'c1', showDate: '2026-06-01', createdAt: '2026-06-02T00:00:00Z' });
    assert.deepEqual(sortConcerts([a, b, c1]).map((x) => x.id), ['c1', 'b', 'a']);
  });

  it('concertsFor includes shows logged by the user OR where they were tagged', () => {
    const mine = concert({ id: 'mine', userId: 'me' });
    const taggedAt = concert({ id: 'tagged', userId: 'friend', taggedUserIds: ['me', 'other'] });
    const unrelated = concert({ id: 'no', userId: 'friend' });
    assert.deepEqual(
      concertsFor('me', [mine, taggedAt, unrelated]).map((c) => c.id).sort(),
      ['mine', 'tagged'],
    );
  });
});
