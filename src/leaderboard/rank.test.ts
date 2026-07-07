/** Unit tests for the pure leaderboard logic (offline). */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type { LeaderboardEntry } from '../social/types';
import { METRICS, mergeCurrentUser, rankBoard, tallyLeaderboard, type Scope } from './rank';

const metric = (key: string) => METRICS.find((m) => m.key === key)!;

describe('tallyLeaderboard', () => {
  const profiles = [
    { userId: 'a', displayName: 'Ana' },
    { userId: 'b', displayName: 'Bo' },
  ];

  it('counts ratings, concerts, and comments per profile', () => {
    const board = tallyLeaderboard(
      profiles,
      ['a', 'a', 'b'], // rated
      ['b'], // shows
      ['a', 'a', 'a'], // reviews
    );
    assert.deepEqual(board, [
      { userId: 'a', displayName: 'Ana', rated: 2, shows: 0, reviews: 3 },
      { userId: 'b', displayName: 'Bo', rated: 1, shows: 1, reviews: 0 },
    ]);
  });

  it('gives profiles with no activity all-zero counts', () => {
    const board = tallyLeaderboard(profiles, [], [], []);
    assert.deepEqual(board.map((e) => e.rated + e.shows + e.reviews), [0, 0]);
  });

  it('ignores activity from ids without a profile (e.g. orphaned rows)', () => {
    const board = tallyLeaderboard(profiles, ['ghost', 'a'], [], []);
    assert.equal(board.find((e) => e.userId === 'a')!.rated, 1);
    assert.ok(!board.some((e) => e.userId === 'ghost'));
  });
});

describe('mergeCurrentUser', () => {
  const entries: LeaderboardEntry[] = [
    { userId: 'a', displayName: 'Ana', rated: 2, shows: 0, reviews: 3 },
    { userId: 'me', displayName: 'Me', rated: 1, shows: 1, reviews: 0 },
  ];

  it('overrides the viewer entry with live counts', () => {
    const live: LeaderboardEntry = { userId: 'me', displayName: 'Me', rated: 9, shows: 4, reviews: 0 };
    const out = mergeCurrentUser(entries, live);
    assert.equal(out.filter((e) => e.userId === 'me').length, 1);
    assert.equal(out.find((e) => e.userId === 'me')!.rated, 9);
  });

  it('inserts the viewer when absent from the server board', () => {
    const live: LeaderboardEntry = { userId: 'new', displayName: 'New', rated: 1, shows: 0, reviews: 0 };
    const out = mergeCurrentUser(entries, live);
    assert.ok(out.some((e) => e.userId === 'new'));
    assert.equal(out.length, entries.length + 1);
  });

  it('is a no-op for a guest (null current)', () => {
    assert.deepEqual(mergeCurrentUser(entries, null), entries);
  });
});

describe('rankBoard', () => {
  const entries: LeaderboardEntry[] = [
    { userId: 'a', displayName: 'Ana', rated: 5, shows: 1, reviews: 0 },
    { userId: 'b', displayName: 'Bo', rated: 5, shows: 3, reviews: 0 }, // ties Ana on rated
    { userId: 'c', displayName: 'Cy', rated: 9, shows: 0, reviews: 2 },
    { userId: 'me', displayName: 'Me', rated: 1, shows: 0, reviews: 0 },
  ];

  it('sorts descending by the chosen metric', () => {
    const out = rankBoard(entries, {
      scope: 'global',
      followingIds: new Set(),
      currentUserId: 'me',
      metric: metric('rated'),
    });
    assert.deepEqual(out.map((e) => e.userId), ['c', 'a', 'b', 'me']);
  });

  it('breaks metric ties by display name for stable medals', () => {
    // Ana and Bo both have rated=5; Ana sorts first alphabetically.
    const out = rankBoard(entries, {
      scope: 'global',
      followingIds: new Set(),
      currentUserId: 'me',
      metric: metric('rated'),
    });
    const ana = out.findIndex((e) => e.userId === 'a');
    const bo = out.findIndex((e) => e.userId === 'b');
    assert.ok(ana < bo);
  });

  it('friends scope keeps the viewer plus followees only', () => {
    const out = rankBoard(entries, {
      scope: 'friends' as Scope,
      followingIds: new Set(['a']),
      currentUserId: 'me',
      metric: metric('rated'),
    });
    assert.deepEqual(new Set(out.map((e) => e.userId)), new Set(['a', 'me']));
  });

  it('does not mutate the input array', () => {
    const before = entries.map((e) => e.userId);
    rankBoard(entries, {
      scope: 'global',
      followingIds: new Set(),
      currentUserId: null,
      metric: metric('shows'),
    });
    assert.deepEqual(entries.map((e) => e.userId), before);
  });
});
