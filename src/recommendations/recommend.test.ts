/** Unit tests for the pure recommendation logic (offline). */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type { Item, RankedItem } from '../ranking/types';
import { recommend, type FriendList } from './recommend';

function item(id: string, over: Partial<Item> = {}): Item {
  return { id, type: 'album', title: `Title ${id}`, artist: `Artist ${id}`, ...over };
}

function rated(id: string, score: number, over: Partial<Item> = {}): RankedItem {
  return { item: item(id, over), score, tiebreak: 0 };
}

function friend(userId: string, compatibility: number, ratings: RankedItem[]): FriendList {
  return { userId, userName: `${userId}-name`, compatibility, ratings };
}

describe('recommend', () => {
  it("excludes items the viewer has already rated", () => {
    const friends = [friend('f1', 80, [rated('a', 9), rated('b', 9)])];
    const recs = recommend(friends, new Set(['a']));
    assert.deepEqual(recs.map((r) => r.item.id), ['b']);
  });

  it('drops ratings below the minimum score', () => {
    const friends = [friend('f1', 80, [rated('a', 7.9), rated('b', 8)])];
    const recs = recommend(friends, new Set());
    assert.deepEqual(recs.map((r) => r.item.id), ['b']);
  });

  it('orders by how loved an item is, then by taste match', () => {
    const friends = [
      friend('f1', 50, [rated('mid', 8.5)]),
      friend('f2', 90, [rated('top', 9.5)]),
    ];
    const recs = recommend(friends, new Set());
    assert.deepEqual(recs.map((r) => r.item.id), ['top', 'mid']);
  });

  it('attributes a shared item to the most-compatible friend', () => {
    const friends = [
      friend('low', 40, [rated('shared', 9)]),
      friend('twin', 88, [rated('shared', 9)]),
    ];
    const recs = recommend(friends, new Set());
    assert.equal(recs.length, 1);
    assert.equal(recs[0].friendId, 'twin');
    assert.equal(recs[0].compatibility, 88);
  });

  it('honors the limit', () => {
    const ratings = ['a', 'b', 'c', 'd'].map((id) => rated(id, 9));
    const recs = recommend([friend('f1', 70, ratings)], new Set(), { limit: 2 });
    assert.equal(recs.length, 2);
  });

  it('returns nothing when there are no followed friends', () => {
    assert.deepEqual(recommend([], new Set()), []);
  });
});
