/** Unit tests for the taste-compatibility algorithm (offline, pure). */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type { RankedItem } from '@/ranking/types';
import { compatibility } from './compatibility';

const ranked = (id: string, title: string, artist: string, score: number): RankedItem => ({
  item: { id, type: 'album', title, artist },
  score,
  tiebreak: 0,
});

describe('compatibility', () => {
  it('identical lists with big overlap approach a full score match', () => {
    // 15 shared items, identical scores, identical artists.
    const list = Array.from({ length: 15 }, (_, i) =>
      ranked(`i${i}`, `Album ${i}`, `Artist ${i}`, 8),
    );
    const c = compatibility(list, list);
    // 0.6·1·1 + 0.4·1 = 100
    assert.equal(c.percent, 100);
    assert.equal(c.overlapCount, 15);
  });

  it('small overlap is damped by coverage even when scores agree', () => {
    const a = [ranked('x', 'X', 'Same Artist', 9)];
    const b = [ranked('x', 'X', 'Same Artist', 9)];
    // score_sim=1, coverage=1/15, artist_sim=1 → 0.6/15 + 0.4 = 0.44
    assert.equal(compatibility(a, b).percent, 44);
  });

  it('no overlap at all falls back to artist similarity alone', () => {
    const a = [ranked('a1', 'A', 'Shared', 9), ranked('a2', 'B', 'OnlyMine', 7)];
    const b = [ranked('b1', 'C', 'Shared', 5), ranked('b2', 'D', 'OnlyTheirs', 6)];
    // artist jaccard = 1/3 → 0.4·(1/3) ≈ 13
    const c = compatibility(a, b);
    assert.equal(c.overlapCount, 0);
    assert.equal(c.percent, 13);
    assert.deepEqual(c.sharedFavorites, []);
  });

  it('score disagreement lowers the match', () => {
    const mk = (score: number) =>
      Array.from({ length: 15 }, (_, i) => ranked(`i${i}`, `Album ${i}`, `Artist ${i}`, score));
    // |9-4|=5 → score_sim=0.5 → 0.6·0.5 + 0.4·1 = 70
    assert.equal(compatibility(mk(9), mk(4)).percent, 70);
  });

  it('shared favorites are the top overlap both loved, best combined first', () => {
    const mine = [
      ranked('great', 'Great', 'A1', 9.5),
      ranked('good', 'Good', 'A2', 8.5),
      ranked('meh', 'Meh', 'A3', 6),
      ranked('split', 'Split', 'A4', 9), // they hated it
    ];
    const theirs = [
      ranked('great', 'Great', 'A1', 9),
      ranked('good', 'Good', 'A2', 8),
      ranked('meh', 'Meh', 'A3', 6.5),
      ranked('split', 'Split', 'A4', 3),
    ];
    const favs = compatibility(mine, theirs).sharedFavorites.map((i) => i.id);
    assert.deepEqual(favs, ['great', 'good']);
  });

  it('falls back to best-loved overlap when nothing clears the favorite bar', () => {
    const mine = [ranked('a', 'A', 'X', 7), ranked('b', 'B', 'Y', 6)];
    const theirs = [ranked('a', 'A', 'X', 7.5), ranked('b', 'B', 'Y', 5)];
    const favs = compatibility(mine, theirs).sharedFavorites.map((i) => i.id);
    assert.deepEqual(favs, ['a', 'b']);
  });

  it('artist matching is case- and whitespace-insensitive', () => {
    const a = [ranked('a1', 'A', ' Frank Ocean ', 9)];
    const b = [ranked('b1', 'B', 'frank ocean', 9)];
    // no item overlap, artist jaccard = 1 → 40
    assert.equal(compatibility(a, b).percent, 40);
  });

  it('two empty lists are simply 0, not NaN', () => {
    const c = compatibility([], []);
    assert.equal(c.percent, 0);
    assert.equal(c.overlapCount, 0);
  });
});
