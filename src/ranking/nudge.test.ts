/** Unit tests for the re-rank nudge logic (offline, pure). */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { applyNudge, pickNudgePair } from './nudge';
import { sortRanked } from './engine';
import type { ComparisonEvent, Item, RankedItem } from './types';

const song = (id: string): Item => ({ id, type: 'song', title: `T-${id}`, artist: 'Test' });
const ranked = (id: string, score: number, tiebreak = 0): RankedItem => ({
  item: song(id),
  score,
  tiebreak,
});
const event = (winnerId: string, loserId: string): ComparisonEvent => ({
  winnerId,
  loserId,
  timestamp: 0,
});

// a > b (tied at 8.5, never compared) ; c below at 7.
const LIST = [ranked('a', 8.5, 1), ranked('b', 8.5, 0), ranked('c', 7)];

describe('pickNudgePair', () => {
  it('prefers an uncompared same-score pair over cross-score neighbours', () => {
    const pair = pickNudgePair(LIST, [], () => 0);
    assert.equal(pair?.above.item.id, 'a');
    assert.equal(pair?.below.item.id, 'b');
    assert.equal(pair?.sameScore, true);
  });

  it('skips pairs already banked (either direction) and falls back to cross-score', () => {
    const pair = pickNudgePair(LIST, [event('b', 'a')], () => 0);
    assert.equal(pair?.above.item.id, 'b'); // b > c is the next adjacent pair
    assert.equal(pair?.below.item.id, 'c');
    assert.equal(pair?.sameScore, false);
  });

  it('returns null when every adjacent pair has been asked', () => {
    const log = [event('a', 'b'), event('c', 'b')];
    assert.equal(pickNudgePair(LIST, log, () => 0), null);
  });

  it('returns null for lists of fewer than two items', () => {
    assert.equal(pickNudgePair([], []), null);
    assert.equal(pickNudgePair([ranked('a', 8)], []), null);
  });

  it('input order does not matter (sorts internally)', () => {
    const shuffled = [LIST[2], LIST[1], LIST[0]];
    const pair = pickNudgePair(shuffled, [], () => 0);
    assert.equal(pair?.above.item.id, 'a');
  });
});

describe('applyNudge', () => {
  it('confirming the current order banks the event and changes nothing', () => {
    const pair = pickNudgePair(LIST, [], () => 0)!;
    const { list, event: e } = applyNudge(LIST, pair, 'above', () => 42);
    assert.deepEqual(e, { winnerId: 'a', loserId: 'b', timestamp: 42 });
    assert.deepEqual(sortRanked(list).map((r) => r.item.id), ['a', 'b', 'c']);
  });

  it('preferring the lower same-score item swaps the pair', () => {
    const pair = pickNudgePair(LIST, [], () => 0)!;
    const { list, event: e } = applyNudge(LIST, pair, 'below', () => 42);
    assert.deepEqual(e, { winnerId: 'b', loserId: 'a', timestamp: 42 });
    assert.deepEqual(sortRanked(list).map((r) => r.item.id), ['b', 'a', 'c']);
    // Only tiebreaks moved; scores are untouched.
    assert.ok(list.every((r) => r.score === LIST.find((x) => x.item.id === r.item.id)!.score));
  });

  it('cross-score answers bank the event but never reorder', () => {
    const pair = pickNudgePair(LIST, [event('a', 'b')], () => 0)!; // b vs c
    assert.equal(pair.sameScore, false);
    const { list, event: e } = applyNudge(LIST, pair, 'below', () => 42);
    assert.deepEqual(e, { winnerId: 'c', loserId: 'b', timestamp: 42 });
    assert.deepEqual(sortRanked(list).map((r) => r.item.id), ['a', 'b', 'c']);
  });
});
