/** Unit tests for the popular-among-follows fold (offline). */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type { Item, RankedItem } from '../ranking/types';
import { popularAmongFollows } from './popular';
import type { FriendList } from './recommend';

function item(id: string, over: Partial<Item> = {}): Item {
  return { id, type: 'album', title: `Title ${id}`, artist: `Artist ${id}`, ...over };
}

function rated(id: string, score: number): RankedItem {
  return { item: item(id), score, tiebreak: 0 };
}

function friend(userId: string, ratings: RankedItem[]): FriendList {
  return { userId, userName: `${userId}-name`, compatibility: 50, ratings };
}

describe('popularAmongFollows', () => {
  it('requires the minimum friend count — one list is not "popular"', () => {
    const friends = [friend('f1', [rated('solo', 10)])];
    assert.deepEqual(popularAmongFollows(friends), []);
  });

  it('tallies distinct friends per item and averages their scores', () => {
    const friends = [
      friend('f1', [rated('shared', 8)]),
      friend('f2', [rated('shared', 10), rated('solo', 10)]),
    ];
    const picks = popularAmongFollows(friends);
    assert.equal(picks.length, 1);
    assert.equal(picks[0].item.id, 'shared');
    assert.equal(picks[0].friendCount, 2);
    assert.equal(picks[0].avgScore, 9);
  });

  it('orders by friend count first, then average score', () => {
    const friends = [
      friend('f1', [rated('wide', 6), rated('loved', 10)]),
      friend('f2', [rated('wide', 6), rated('loved', 9)]),
      friend('f3', [rated('wide', 6)]),
    ];
    const picks = popularAmongFollows(friends);
    // 'wide' has 3 raters at 6.0; 'loved' has 2 at 9.5 — count wins.
    assert.deepEqual(picks.map((p) => p.item.id), ['wide', 'loved']);
  });

  it('includes items the viewer has rated too — social proof, not discovery', () => {
    // No viewer-exclusion parameter exists by design; assert the full tally.
    const friends = [
      friend('f1', [rated('a', 9)]),
      friend('f2', [rated('a', 9)]),
    ];
    assert.equal(popularAmongFollows(friends).length, 1);
  });

  it('caps at the limit', () => {
    const many = Array.from({ length: 15 }, (_, i) => rated(`i${String(i).padStart(2, '0')}`, 8));
    const friends = [friend('f1', many), friend('f2', many)];
    assert.equal(popularAmongFollows(friends, { limit: 10 }).length, 10);
  });
});
