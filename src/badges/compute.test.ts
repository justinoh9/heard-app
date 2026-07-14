/** Unit tests for the pure badges computation (offline). */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type { RankedItem } from '../ranking/types';
import { badgeInputsFromRanked, computeBadges, earnedCount, type BadgeInputs } from './compute';

const ZERO: BadgeInputs = {
  ratingCount: 0,
  genreCount: 0,
  decadeCount: 0,
  concertCount: 0,
  longestStreak: 0,
  listCount: 0,
  queueCount: 0,
};

function rated(id: string, over: Partial<RankedItem['item']> = {}): RankedItem {
  return {
    item: { id, type: 'album', title: `Title ${id}`, artist: `Artist ${id}`, ...over },
    score: 8,
    tiebreak: 0,
  };
}

describe('computeBadges', () => {
  it('earns nothing on a fresh account and everything at high counts', () => {
    const fresh = computeBadges(ZERO);
    assert.equal(earnedCount(fresh), 0);

    const maxed = computeBadges({
      ratingCount: 100,
      genreCount: 6,
      decadeCount: 5,
      concertCount: 15,
      longestStreak: 30,
      listCount: 1,
      queueCount: 5,
    });
    assert.equal(earnedCount(maxed), maxed.length);
  });

  it('earns exactly at the threshold and reports capped progress below it', () => {
    const badges = computeBadges({ ...ZERO, ratingCount: 10 });
    const ten = badges.find((b) => b.id === 'ten-deep')!;
    assert.equal(ten.earned, true);
    const fifty = badges.find((b) => b.id === 'deep-cuts')!;
    assert.equal(fifty.earned, false);
    assert.equal(fifty.have, 10);
    assert.equal(fifty.need, 50);
  });

  it('caps displayed progress at the threshold', () => {
    const badges = computeBadges({ ...ZERO, ratingCount: 250 });
    const century = badges.find((b) => b.id === 'century-club')!;
    assert.equal(century.have, 100);
  });

  it('keeps a stable id set (screens key on these)', () => {
    const ids = computeBadges(ZERO).map((b) => b.id);
    assert.equal(new Set(ids).size, ids.length);
    assert.ok(ids.includes('first-spin'));
    assert.ok(ids.includes('front-row'));
  });
});

describe('badgeInputsFromRanked', () => {
  const rest = { concertCount: 2, longestStreak: 4, listCount: 1, queueCount: 0 };

  it('counts distinct genres case-insensitively and skips the generic Music', () => {
    const inputs = badgeInputsFromRanked(
      [
        rated('a', { genre: 'Rock' }),
        rated('b', { genre: 'rock' }),
        rated('c', { genre: 'Jazz' }),
        rated('d', { genre: 'Music' }),
        rated('e', {}),
      ],
      rest,
    );
    assert.equal(inputs.ratingCount, 5);
    assert.equal(inputs.genreCount, 2);
  });

  it('counts distinct decades from item years, ignoring missing/invalid ones', () => {
    const inputs = badgeInputsFromRanked(
      [
        rated('a', { year: '1994' }),
        rated('b', { year: '1999' }),
        rated('c', { year: '2016' }),
        rated('d', { year: '' }),
        rated('e', {}),
      ],
      rest,
    );
    assert.equal(inputs.decadeCount, 2);
    assert.equal(inputs.concertCount, 2);
    assert.equal(inputs.longestStreak, 4);
  });
});
