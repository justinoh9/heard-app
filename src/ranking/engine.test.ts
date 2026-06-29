import assert from 'node:assert/strict';
import { test } from 'node:test';

import { RatingTiebreakEngine, sortRanked } from './engine';
import type { Item, RankedItem } from './types';

const song = (id: string, title: string): Item => ({
  id,
  type: 'song',
  title,
  artist: 'Test',
});

const engine = new RatingTiebreakEngine(() => 0);

/** Drive a placement, answering each comparison with the given decider. */
function place(
  list: RankedItem[],
  item: Item,
  score: number,
  decide: (c: { againstId: string }) => 'new' | 'existing',
) {
  const p = engine.startPlacement(list, item, score);
  let c;
  let comparisons = 0;
  while ((c = p.next())) {
    comparisons++;
    p.choose(decide({ againstId: c.against.id }));
  }
  return { ...p.commit(), comparisons };
}

const ids = (list: RankedItem[]) => sortRanked(list).map((r) => r.item.id);

test('first rating: no comparison, just inserts', () => {
  const { list, comparisons } = place([], song('a', 'A'), 8.5, () => 'new');
  assert.equal(comparisons, 0);
  assert.deepEqual(ids(list), ['a']);
});

test('unique score: no comparison even with other songs present', () => {
  const start: RankedItem[] = [{ item: song('a', 'A'), score: 9, tiebreak: 0 }];
  const { list, comparisons } = place(start, song('b', 'B'), 7, () => 'new');
  assert.equal(comparisons, 0);
  // 9 sorts above 7
  assert.deepEqual(ids(list), ['a', 'b']);
});

test('tie: new song wins, ranks above the tied song', () => {
  const start: RankedItem[] = [{ item: song('a', 'A'), score: 8.5, tiebreak: 0 }];
  const { list, comparisons } = place(start, song('b', 'B'), 8.5, () => 'new');
  assert.equal(comparisons, 1);
  assert.deepEqual(ids(list), ['b', 'a']);
});

test('tie: new song loses, ranks below the tied song', () => {
  const start: RankedItem[] = [{ item: song('a', 'A'), score: 8.5, tiebreak: 0 }];
  const { list } = place(start, song('b', 'B'), 8.5, () => 'existing');
  assert.deepEqual(ids(list), ['a', 'b']);
});

test('three-way tie resolves with binary insertion (~2 comparisons)', () => {
  // Existing order at 8.5: a (top) > b > c (bottom).
  const start: RankedItem[] = [
    { item: song('a', 'A'), score: 8.5, tiebreak: 2 },
    { item: song('b', 'B'), score: 8.5, tiebreak: 1 },
    { item: song('c', 'C'), score: 8.5, tiebreak: 0 },
  ];
  // New song 'x' beats b but loses to a → should land between a and b.
  const { list, comparisons, events } = place(start, song('x', 'X'), 8.5, ({ againstId }) =>
    againstId === 'a' ? 'existing' : 'new',
  );
  assert.deepEqual(ids(list), ['a', 'x', 'b', 'c']);
  assert.ok(comparisons <= 2, `expected <= 2 comparisons, got ${comparisons}`);
  // Every comparison was logged.
  assert.equal(events.length, comparisons);
});

test('tiebreaks are renumbered to clean consecutive integers within the score', () => {
  const start: RankedItem[] = [
    { item: song('a', 'A'), score: 8.5, tiebreak: 2 },
    { item: song('b', 'B'), score: 8.5, tiebreak: 1 },
  ];
  const { list } = place(start, song('x', 'X'), 8.5, () => 'new'); // x beats all
  const group = sortRanked(list);
  assert.deepEqual(
    group.map((r) => r.tiebreak),
    [2, 1, 0],
  );
});

test('computeScores returns the user-entered scores', () => {
  const list: RankedItem[] = [
    { item: song('a', 'A'), score: 8.5, tiebreak: 1 },
    { item: song('b', 'B'), score: 6, tiebreak: 0 },
  ];
  const scores = engine.computeScores(list);
  assert.equal(scores.get('a'), 8.5);
  assert.equal(scores.get('b'), 6);
});
