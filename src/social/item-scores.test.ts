/** Unit tests for the pure item-page score aggregation (offline). */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { formatCount, summarizeItemScores } from './item-scores';
import type { ItemRating } from './types';

const names: Record<string, string> = {
  me: 'My Self',
  ana: 'Ana Beltran',
  bo: 'Bo Diaz',
  stranger: 'Stranger Danger',
};
const nameFor = (id: string) => names[id] ?? 'A friend';

const ratings: ItemRating[] = [
  { userId: 'me', score: 8.0 },
  { userId: 'ana', score: 9.0 },
  { userId: 'bo', score: 7.0 },
  { userId: 'stranger', score: 5.0 },
];

describe('summarizeItemScores', () => {
  const following = new Set(['ana', 'bo']);

  it('averages every rating for the global figure', () => {
    const s = summarizeItemScores(ratings, { followingIds: following, nameFor, viewerId: 'me' });
    assert.equal(s.globalCount, 4);
    assert.equal(s.globalAvg, 7.3); // (8+9+7+5)/4 = 7.25 -> snapped 7.3 (round-half-up on ×10)
  });

  it('includes only followed users (never the viewer) in friends', () => {
    const s = summarizeItemScores(ratings, {
      followingIds: following,
      nameFor,
      viewerId: 'me',
      yourScore: 8.0,
    });
    assert.deepEqual(s.friends.map((f) => f.userId), ['ana', 'bo']); // sorted high->low
    assert.equal(s.friendsAvg, 8.0); // (9+7)/2
    assert.equal(s.you, 8.0);
  });

  it('resolves friend display names and initials', () => {
    const s = summarizeItemScores(ratings, { followingIds: following, nameFor, viewerId: 'me' });
    const ana = s.friends.find((f) => f.userId === 'ana')!;
    assert.equal(ana.displayName, 'Ana Beltran');
    assert.equal(ana.initials, 'AB');
  });

  it('sorts friends by score, ties broken by name', () => {
    const tied: ItemRating[] = [
      { userId: 'bo', score: 8.0 },
      { userId: 'ana', score: 8.0 },
    ];
    const s = summarizeItemScores(tied, {
      followingIds: new Set(['ana', 'bo']),
      nameFor,
      viewerId: 'me',
    });
    assert.deepEqual(s.friends.map((f) => f.userId), ['ana', 'bo']);
  });

  it('honest empty states when nothing has been rated', () => {
    const s = summarizeItemScores([], { followingIds: following, nameFor, viewerId: 'me' });
    assert.equal(s.globalCount, 0);
    assert.equal(s.globalAvg, undefined);
    assert.deepEqual(s.friends, []);
    assert.equal(s.friendsAvg, undefined);
  });

  it('global stats show for a guest with no follows; friends stay empty', () => {
    const s = summarizeItemScores(ratings, { followingIds: new Set(), nameFor, viewerId: null });
    assert.equal(s.globalCount, 4);
    assert.ok(s.globalAvg !== undefined);
    assert.deepEqual(s.friends, []);
  });
});

describe('formatCount', () => {
  it('abbreviates thousands', () => {
    assert.equal(formatCount(842), '842');
    assert.equal(formatCount(1290), '1.3k');
    assert.equal(formatCount(2000), '2k');
  });
});
