/** Unit tests for Top 4 resolution (offline, pure). */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type { RankedItem } from '@/ranking/types';
import { resolveFavorites } from './favorites';

const ranked = (id: string, score: number): RankedItem => ({
  item: { id, type: 'album', title: `T-${id}`, artist: `A-${id}` },
  score,
  tiebreak: 0,
});

const list = [ranked('a', 9.5), ranked('b', 9), ranked('c', 8.5), ranked('d', 8), ranked('e', 7)];

describe('resolveFavorites', () => {
  it('keeps the chosen order, not rank order', () => {
    const { items, chosen } = resolveFavorites(['d', 'a', 'c'], list);
    assert.equal(chosen, true);
    assert.deepEqual(items.map((r) => r.item.id), ['d', 'a', 'c']);
  });

  it('drops ids no longer in the ranked list', () => {
    const { items, chosen } = resolveFavorites(['a', 'gone', 'e'], list);
    assert.equal(chosen, true);
    assert.deepEqual(items.map((r) => r.item.id), ['a', 'e']);
  });

  it('caps at four even if more ids are stored', () => {
    const { items } = resolveFavorites(['a', 'b', 'c', 'd', 'e'], list);
    assert.equal(items.length, 4);
  });

  it('falls back to the top of the ranked list when nothing is chosen', () => {
    for (const ids of [undefined, [] as string[], ['gone']]) {
      const { items, chosen } = resolveFavorites(ids, list);
      assert.equal(chosen, false, `ids=${JSON.stringify(ids)}`);
      assert.deepEqual(items.map((r) => r.item.id), ['a', 'b', 'c', 'd']);
    }
  });

  it('empty ranked list resolves to nothing without crashing', () => {
    const { items, chosen } = resolveFavorites(['a'], []);
    assert.equal(chosen, false);
    assert.deepEqual(items, []);
  });
});
