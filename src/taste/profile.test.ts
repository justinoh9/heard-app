import assert from 'node:assert/strict';
import { test } from 'node:test';

import { computeTasteProfile, ratingStyle } from './profile';
import type { BucketStat } from '../data/stats';
import type { Item, RankedItem } from '../ranking/types';

const album = (id: string, title: string, artist: string, year?: string, genre?: string): Item => ({
  id,
  type: 'album',
  title,
  artist,
  year,
  genre,
});
const rated = (item: Item, score: number): RankedItem => ({ item, score, tiebreak: 0 });

/** Build a 5-bucket histogram from raw counts [0-2,2-4,4-6,6-8,8-10]. */
const hist = (counts: number[]): BucketStat[] =>
  ['0–2', '2–4', '4–6', '6–8', '8–10'].map((label, i) => ({ label, count: counts[i] ?? 0 }));

test('ratingStyle: too few ratings → getting started', () => {
  assert.equal(ratingStyle(9, hist([0, 0, 0, 0, 2]), 2).key, 'new');
  assert.equal(ratingStyle(null, hist([0, 0, 0, 0, 0]), 0).key, 'new');
});

test('ratingStyle: high mean → generous', () => {
  assert.equal(ratingStyle(8.4, hist([0, 0, 1, 3, 6]), 10).key, 'generous');
});

test('ratingStyle: low mean → critical', () => {
  assert.equal(ratingStyle(5.0, hist([3, 4, 3, 0, 0]), 10).key, 'critical');
});

test('ratingStyle: mass at both ends → polarizing (beats a high mean)', () => {
  // 4 low (0–4) + 4 high (8–10), nothing in the middle.
  const style = ratingStyle(6.5, hist([2, 2, 0, 0, 4]), 8);
  assert.equal(style.key, 'polarizing');
});

test('ratingStyle: all-high is generous, not polarizing (no low mass)', () => {
  assert.equal(ratingStyle(9.0, hist([0, 0, 0, 2, 8]), 10).key, 'generous');
});

test('ratingStyle: middling mean, spread out → balanced', () => {
  assert.equal(ratingStyle(6.6, hist([0, 1, 3, 4, 2]), 10).key, 'balanced');
});

test('computeTasteProfile: aggregates artists, decade, mean', () => {
  const list: RankedItem[] = [
    rated(album('a', 'Blonde', 'Frank Ocean', '2016'), 9.5),
    rated(album('b', 'channel ORANGE', 'Frank Ocean', '2012'), 9.0),
    rated(album('c', 'IGOR', 'Tyler, The Creator', '2019'), 8.0),
  ];
  const profile = computeTasteProfile(list);
  assert.equal(profile.ratedCount, 3);
  assert.equal(profile.meanScore, 8.8);
  assert.equal(profile.topArtists[0].name, 'Frank Ocean');
  assert.equal(profile.topArtists[0].count, 2);
  assert.equal(profile.topDecade, '2010s');
  assert.equal(profile.style.key, 'generous');
});

test('computeTasteProfile: aggregates genres, dropping the generic "Music"', () => {
  const list: RankedItem[] = [
    rated(album('a', 'Blonde', 'Frank Ocean', '2016', 'R&B/Soul'), 9),
    rated(album('b', 'channel ORANGE', 'Frank Ocean', '2012', 'R&B/Soul'), 8),
    rated(album('c', 'IGOR', 'Tyler', '2019', 'Hip-Hop/Rap'), 8),
    rated(album('d', 'Untitled', 'Nobody', '2020', 'Music'), 7), // generic → dropped
  ];
  const profile = computeTasteProfile(list);
  assert.equal(profile.topGenres[0].label, 'R&B/Soul');
  assert.equal(profile.topGenres[0].count, 2);
  assert.ok(!profile.topGenres.some((g) => g.label === 'Music'));
});

test('computeTasteProfile: empty list is a safe "new" profile', () => {
  const profile = computeTasteProfile([]);
  assert.equal(profile.ratedCount, 0);
  assert.equal(profile.meanScore, null);
  assert.equal(profile.style.key, 'new');
  assert.equal(profile.topDecade, null);
  assert.deepEqual(profile.topArtists, []);
  assert.deepEqual(profile.topGenres, []);
});
