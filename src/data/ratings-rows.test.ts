/** Unit tests for the pure ratings row ↔ model mapping (offline). */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type { RankedItem } from '@/ranking/types';
import {
  fromComparisonRow,
  fromRatingRow,
  toComparisonRow,
  toItemRow,
  toRatingRow,
} from './ratings-rows';

const ranked: RankedItem = {
  item: { id: 'sp-123', type: 'album', title: 'Blonde', artist: 'Frank Ocean', artUrl: 'https://img/b.jpg' },
  score: 9.6,
  tiebreak: 2,
};

describe('ratings rows', () => {
  it('toItemRow maps the item, null-ing a missing art url', () => {
    assert.deepEqual(toItemRow(ranked.item), {
      id: 'sp-123',
      type: 'album',
      title: 'Blonde',
      artist: 'Frank Ocean',
      art_url: 'https://img/b.jpg',
    });
    assert.equal(toItemRow({ ...ranked.item, artUrl: undefined }).art_url, null);
  });

  it('toRatingRow carries user, item, score, and tiebreak', () => {
    assert.deepEqual(toRatingRow('u1', ranked), {
      user_id: 'u1',
      item_id: 'sp-123',
      score: 9.6,
      tiebreak: 2,
    });
  });

  it('fromRatingRow round-trips a select row back to a RankedItem', () => {
    const row = {
      score: 9.6,
      tiebreak: 2,
      items: { id: 'sp-123', type: 'album', title: 'Blonde', artist: 'Frank Ocean', art_url: null },
    };
    const out = fromRatingRow(row);
    assert.deepEqual(out, {
      item: { id: 'sp-123', type: 'album', title: 'Blonde', artist: 'Frank Ocean', artUrl: undefined },
      score: 9.6,
      tiebreak: 2,
    });
  });

  it('comparison events round-trip through ISO timestamps losslessly', () => {
    const event = { winnerId: 'a', loserId: 'b', timestamp: 1_751_400_000_123 };
    const row = toComparisonRow('u1', event);
    assert.equal(row.user_id, 'u1');
    assert.equal(row.compared_at, new Date(event.timestamp).toISOString());
    assert.deepEqual(fromComparisonRow(row), event);
  });
});
