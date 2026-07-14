/** Unit tests for concert row mapping + per-viewer slices (offline). */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  attendedFor,
  concertsFor,
  confirmedAttendees,
  fromConcertRow,
  invitesFor,
  sortConcerts,
  tagFromRow,
  toConcertRow,
  wishlistFor,
  type ConcertRow,
} from './rows';
import type { Concert, ConcertTag, NewConcert } from './types';

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
  status: 'attended',
};

const concert = (over: Partial<Concert>): Concert => ({
  id: 'x',
  userId: 'u1',
  artistName: 'A',
  showDate: '2026-01-01',
  status: 'attended',
  tags: [],
  createdAt: '2026-01-01T00:00:00.000Z',
  ...over,
});

const tag = (userId: string, status: ConcertTag['status']): ConcertTag => ({ userId, status });

describe('concert rows', () => {
  it('fromConcertRow maps nullables, status, and tags', () => {
    const c = fromConcertRow(row, [tag('u2', 'confirmed')]);
    assert.equal(c.artistName, 'Tame Impala');
    assert.equal(c.venue, 'Red Rocks');
    assert.equal(c.artistId, undefined);
    assert.equal(c.score, 9.5);
    assert.equal(c.status, 'attended');
    assert.deepEqual(c.tags, [{ userId: 'u2', status: 'confirmed' }]);
  });

  it('fromConcertRow defaults a missing status to attended (pre-0017 rows)', () => {
    const c = fromConcertRow({ ...row, status: undefined }, []);
    assert.equal(c.status, 'attended');
  });

  it('tagFromRow defaults a missing tag status to confirmed (pre-0017 rows)', () => {
    assert.deepEqual(tagFromRow({ concert_id: 'c1', user_id: 'u2' }), {
      userId: 'u2',
      status: 'confirmed',
    });
    assert.deepEqual(tagFromRow({ concert_id: 'c1', user_id: 'u2', status: 'pending' }), {
      userId: 'u2',
      status: 'pending',
    });
  });

  it('toConcertRow omits status for an attended show, includes it for wishlist', () => {
    const base: NewConcert = {
      userId: 'u1',
      artistName: 'A',
      showDate: '2026-01-01',
      status: 'attended',
      taggedUserIds: [],
    };
    assert.equal('status' in toConcertRow(base), false);
    assert.equal(toConcertRow({ ...base, status: 'wishlist' }).status, 'wishlist');
  });

  it('sortConcerts is newest show first, log time breaking date ties', () => {
    const a = concert({ id: 'a', showDate: '2026-05-01' });
    const b = concert({ id: 'b', showDate: '2026-06-01' });
    const c1 = concert({ id: 'c1', showDate: '2026-06-01', createdAt: '2026-06-02T00:00:00Z' });
    assert.deepEqual(sortConcerts([a, b, c1]).map((x) => x.id), ['c1', 'b', 'a']);
  });

  it('confirmedAttendees lists only confirmed tags', () => {
    const c = concert({ tags: [tag('a', 'confirmed'), tag('b', 'pending')] });
    assert.deepEqual(confirmedAttendees(c), ['a']);
  });
});

describe('per-viewer slices', () => {
  const mine = concert({ id: 'mine', userId: 'me', status: 'attended' });
  const myWish = concert({ id: 'wish', userId: 'me', status: 'wishlist' });
  const confirmedAt = concert({
    id: 'confirmed',
    userId: 'friend',
    status: 'attended',
    tags: [tag('me', 'confirmed')],
  });
  const pendingAt = concert({
    id: 'pending',
    userId: 'friend',
    status: 'attended',
    tags: [tag('me', 'pending')],
  });
  const unrelated = concert({ id: 'no', userId: 'friend' });
  const all = [mine, myWish, confirmedAt, pendingAt, unrelated];

  it('concertsFor returns everything relevant (owned or tagged, any status)', () => {
    assert.deepEqual(
      concertsFor('me', all).map((c) => c.id).sort(),
      ['confirmed', 'mine', 'pending', 'wish'],
    );
  });

  it('attendedFor = owned attended + confirmed-tagged attended (no pending, no wishlist)', () => {
    assert.deepEqual(attendedFor('me', all).map((c) => c.id).sort(), ['confirmed', 'mine']);
  });

  it('wishlistFor = only the viewer own wishlist entries', () => {
    assert.deepEqual(wishlistFor('me', all).map((c) => c.id), ['wish']);
  });

  it('invitesFor = pending tags on other people shows', () => {
    assert.deepEqual(invitesFor('me', all).map((c) => c.id), ['pending']);
  });
});
