import assert from 'node:assert/strict';
import { test } from 'node:test';

import { rankFollowSuggestions, type SuggestionCandidate } from './suggestions';
import type { Item, RankedItem } from '../ranking/types';

const album = (id: string, title: string, artist: string): Item => ({
  id,
  type: 'album',
  title,
  artist,
});

const rated = (item: Item, score: number): RankedItem => ({ item, score, tiebreak: 0 });

const BLONDE = album('a', 'Blonde', 'Frank Ocean');
const IGOR = album('b', 'IGOR', 'Tyler, The Creator');
const SOS = album('c', 'SOS', 'SZA');
const RUMOURS = album('d', 'Rumours', 'Fleetwood Mac');

const MINE: RankedItem[] = [rated(BLONDE, 9.5), rated(IGOR, 8.5)];

test('ranks a close-taste candidate above a distant one', () => {
  const candidates: SuggestionCandidate[] = [
    { userId: 'twin', displayName: 'Twin', list: [rated(BLONDE, 9.4), rated(IGOR, 8.6)] },
    { userId: 'far', displayName: 'Far', list: [rated(RUMOURS, 3)] },
  ];
  const out = rankFollowSuggestions(MINE, candidates);
  assert.equal(out[0].userId, 'twin');
  assert.ok(out[0].percent >= (out[1]?.percent ?? 0));
});

test('drops candidates with nothing in common', () => {
  const candidates: SuggestionCandidate[] = [
    { userId: 'stranger', displayName: 'Stranger', list: [rated(RUMOURS, 7)] },
  ];
  // No shared items and no shared artist → filtered out entirely.
  assert.deepEqual(rankFollowSuggestions(MINE, candidates), []);
});

test('shared artist alone (no overlapping items) still surfaces a match', () => {
  const otherSZAlover: SuggestionCandidate = {
    userId: 'sza',
    displayName: 'Sza Fan',
    // Rates a DIFFERENT SZA album — no item overlap, but artist overlap.
    list: [rated(album('e', 'Ctrl', 'SZA'), 9)],
  };
  const mineWithSza = [...MINE, rated(SOS, 9)];
  const out = rankFollowSuggestions(mineWithSza, [otherSZAlover]);
  assert.equal(out.length, 1);
  assert.ok(out[0].percent > 0);
});

test('respects the max cap and sorts by percent desc', () => {
  const candidates: SuggestionCandidate[] = Array.from({ length: 8 }, (_, i) => ({
    userId: `u${i}`,
    displayName: `User ${i}`,
    // Increasingly different scores → decreasing match.
    list: [rated(BLONDE, 9.5 - i * 0.5), rated(IGOR, 8.5)],
  }));
  const out = rankFollowSuggestions(MINE, candidates, 3);
  assert.equal(out.length, 3);
  for (let i = 1; i < out.length; i++) {
    assert.ok(out[i - 1].percent >= out[i].percent);
  }
});
