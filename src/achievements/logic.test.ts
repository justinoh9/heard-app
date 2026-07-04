/** Unit tests for the achievements rollup (offline, pure). */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type { Concert } from '@/concerts/types';
import type { RankedItem } from '@/ranking/types';

import { computeAchievements, type AchievementInput } from './logic';

const rated = (id: string, artist: string, year?: string): RankedItem => ({
  item: { id, type: 'album', title: id, artist, year },
  score: 8,
  tiebreak: 0,
});

const show = (id: string): Concert => ({
  id,
  userId: 'u1',
  artistName: 'A',
  showDate: '2026-01-01',
  taggedUserIds: [],
  createdAt: '2026-01-01T00:00:00.000Z',
});

const run = (over: Partial<AchievementInput>) =>
  computeAchievements({ ranked: [], concerts: [], longestStreak: 0, ...over });

describe('computeAchievements', () => {
  it('earns nothing from an empty profile but still lists every badge', () => {
    const s = run({});
    assert.equal(s.earnedCount, 0);
    assert.equal(s.total, s.badges.length);
    assert.ok(s.total >= 15);
    assert.ok(s.badges.every((b) => !b.earned && b.progress === 0));
  });

  it('unlocks a rating tier at exactly the threshold, not below', () => {
    const nine = run({ ranked: Array.from({ length: 9 }, (_, i) => rated(`r${i}`, `Artist ${i}`)) });
    assert.equal(nine.badges.find((b) => b.id === 'rate-10')!.earned, false);
    assert.equal(nine.badges.find((b) => b.id === 'rate-10')!.progress, 9);

    const ten = run({ ranked: Array.from({ length: 10 }, (_, i) => rated(`r${i}`, `Artist ${i}`)) });
    assert.equal(ten.badges.find((b) => b.id === 'rate-10')!.earned, true);
    assert.equal(ten.badges.find((b) => b.id === 'rate-1')!.earned, true);
  });

  it('counts distinct artists — case-insensitive dedup, comma credits split', () => {
    const s = run({
      ranked: [
        rated('a', 'Frank Ocean'),
        rated('b', 'frank ocean'), // same artist, different case → 1
        rated('c', 'SZA, Drake'), // two credits → +2
      ],
    });
    // Frank Ocean + SZA + Drake = 3 distinct (same comma-split as stats.ts).
    assert.equal(s.badges.find((b) => b.id === 'artist-10')!.progress, 3);
  });

  it('decades collapse by 10-year bucket', () => {
    const s = run({
      ranked: [rated('a', 'X', '2001'), rated('b', 'Y', '2009'), rated('c', 'Z', '2015')],
    });
    // 2000s (x2) + 2010s = 2 distinct decades.
    assert.equal(s.badges.find((b) => b.id === 'decade-3')!.progress, 2);
    assert.equal(s.badges.find((b) => b.id === 'decade-3')!.earned, false);
  });

  it('uses longest streak (permanent) for streak tiers', () => {
    const s = run({ longestStreak: 30 });
    assert.equal(s.badges.find((b) => b.id === 'streak-30')!.earned, true);
    assert.equal(s.badges.find((b) => b.id === 'streak-100')!.earned, false);
  });

  it('counts logged shows toward concert tiers', () => {
    const s = run({ concerts: Array.from({ length: 5 }, (_, i) => show(`c${i}`)) });
    assert.equal(s.badges.find((b) => b.id === 'show-5')!.earned, true);
    assert.equal(s.badges.find((b) => b.id === 'show-10')!.earned, false);
  });

  it('nextUp is the closest locked badge by completion ratio', () => {
    // 9/10 ratings (0.9) beats 4/5 shows (0.8). Same artist keeps the artist
    // tier low so it doesn't tie the ratings tier.
    const s = run({
      ranked: Array.from({ length: 9 }, (_, i) => rated(`r${i}`, 'One Artist')),
      concerts: Array.from({ length: 4 }, (_, i) => show(`c${i}`)),
    });
    assert.equal(s.nextUp!.id, 'rate-10');
  });

  it('nextUp is null once every badge is earned', () => {
    const s = run({
      ranked: Array.from({ length: 100 }, (_, i) => rated(`r${i}`, `Artist ${i}`, `${1950 + i}`)),
      concerts: Array.from({ length: 25 }, (_, i) => show(`c${i}`)),
      longestStreak: 100,
    });
    assert.equal(s.earnedCount, s.total);
    assert.equal(s.nextUp, null);
  });
});
