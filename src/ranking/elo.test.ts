/** Unit tests for the pure Elo ordering (offline). */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { ELO_BASE, computeEloRatings, countMoved, rerankByElo } from './elo';
import type { ComparisonEvent, RankedItem } from './types';

let clock = 0;
function beat(winnerId: string, loserId: string): ComparisonEvent {
  return { winnerId, loserId, timestamp: (clock += 1) };
}

function ranked(id: string, score: number, tiebreak: number): RankedItem {
  return { item: { id, type: 'album', title: id, artist: 'x' }, score, tiebreak };
}

describe('computeEloRatings', () => {
  it('raises the winner above the loser and stays zero-sum', () => {
    const r = computeEloRatings([beat('a', 'b')]);
    assert.ok(r.get('a')! > ELO_BASE);
    assert.ok(r.get('b')! < ELO_BASE);
    // Equal and opposite deltas.
    assert.ok(Math.abs(r.get('a')! - ELO_BASE - (ELO_BASE - r.get('b')!)) < 1e-9);
  });

  it('rewards repeated wins monotonically', () => {
    const one = computeEloRatings([beat('a', 'b')]).get('a')!;
    const three = computeEloRatings([beat('a', 'b'), beat('a', 'b'), beat('a', 'b')]).get('a')!;
    assert.ok(three > one);
  });

  it('gives diminishing returns for beating a much weaker opponent', () => {
    // After a is far ahead, another win over b nudges less than the first did.
    const events = [beat('a', 'b'), beat('a', 'b'), beat('a', 'b'), beat('a', 'b')];
    const firstGain = (() => {
      const r = computeEloRatings(events.slice(0, 1));
      return r.get('a')! - ELO_BASE;
    })();
    const lastGain = (() => {
      const before = computeEloRatings(events.slice(0, 3)).get('a')!;
      const after = computeEloRatings(events.slice(0, 4)).get('a')!;
      return after - before;
    })();
    assert.ok(lastGain < firstGain);
  });

  it('ignores a self-match and orders replay by timestamp', () => {
    const r = computeEloRatings([
      { winnerId: 'a', loserId: 'a', timestamp: 5 },
      { winnerId: 'a', loserId: 'b', timestamp: 1 },
    ]);
    assert.equal(r.has('a'), true);
    assert.ok(r.get('a')! > r.get('b')!);
  });
});

describe('rerankByElo', () => {
  const list = [ranked('a', 9, 2), ranked('b', 9, 1), ranked('c', 9, 0), ranked('d', 8, 5)];

  it('reorders within a score group by head-to-head record', () => {
    // c beats a and b twice → c should rise to the top of the 9-group.
    const events = [beat('c', 'a'), beat('c', 'b'), beat('c', 'a'), beat('c', 'b')];
    const order = rerankByElo(list, events).map((r) => r.item.id);
    assert.equal(order[0], 'c');
    // d (score 8) stays last — score dominates Elo.
    assert.equal(order[order.length - 1], 'd');
  });

  it('never moves an item across score boundaries', () => {
    // Even if d (score 8) somehow "beat" everyone, it can't outrank the 9s.
    const events = [beat('d', 'a'), beat('d', 'b'), beat('d', 'c')];
    const order = rerankByElo(list, events).map((r) => r.item.id);
    assert.equal(order[order.length - 1], 'd');
  });

  it('falls back to tie-break order when a group has no comparisons', () => {
    const order = rerankByElo(list, []).map((r) => r.item.id);
    assert.deepEqual(order, ['a', 'b', 'c', 'd']);
  });

  it('does not mutate the input list', () => {
    const copy = [...list];
    rerankByElo(list, [beat('c', 'a')]);
    assert.deepEqual(list, copy);
  });
});

describe('countMoved', () => {
  it('counts positions that differ between two orderings', () => {
    const a = [ranked('a', 9, 2), ranked('b', 9, 1), ranked('c', 9, 0)];
    const b = [ranked('c', 9, 0), ranked('b', 9, 1), ranked('a', 9, 2)];
    assert.equal(countMoved(a, b), 2); // a and c swapped ends; b stayed
    assert.equal(countMoved(a, a), 0);
  });
});
