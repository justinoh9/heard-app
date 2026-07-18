import assert from 'node:assert/strict';
import { test } from 'node:test';

import { tasteTwin, tasteTwinNotifications, type TwinFriend } from './taste-twin';
import type { FriendRating } from '@/recommendations/types';
import type { Item, ItemType } from '@/ranking/types';

const NOW = new Date('2026-07-18T12:00:00Z');

const item = (id: string, type: ItemType = 'album'): Item => ({
  id,
  type,
  title: id,
  artist: 'x',
});
const rating = (id: string, score: number, ratedAt?: string, type?: ItemType): FriendRating => ({
  item: item(id, type),
  score,
  tiebreak: 0,
  ratedAt,
});
const friend = (
  userId: string,
  compatibility: number,
  ratings: FriendRating[] = [],
): TwinFriend => ({ userId, userName: userId, compatibility, ratings });

test('tasteTwin picks the most compatible friend above the floor', () => {
  assert.equal(tasteTwin([friend('a', 60), friend('b', 88), friend('c', 72)])?.userId, 'b');
  assert.equal(tasteTwin([friend('a', 49)]), null);
  assert.equal(tasteTwin([]), null);
});

test('tasteTwin breaks compatibility ties stably by name', () => {
  assert.equal(tasteTwin([friend('zed', 80), friend('amy', 80)])?.userId, 'amy');
});

test('tasteTwinNotifications pings the twin’s recent high ratings, newest first', () => {
  const twin = friend('maya', 88, [
    rating('new-9', 9.2, '2026-07-16T10:00:00Z'),
    rating('newer-8', 8.0, '2026-07-17T10:00:00Z'),
    rating('old-10', 10, '2026-01-01T00:00:00Z'), // outside the window
    rating('low', 5, '2026-07-16T09:00:00Z'), // below the loved-it bar
    rating('undated', 9.9), // local snapshot — can't prove recency
  ]);
  const out = tasteTwinNotifications([twin, friend('other', 70)], new Set(), NOW);
  assert.deepEqual(out.map((n) => n.subject), ['newer-8', 'new-9']);
  assert.equal(out[0].kind, 'twin');
  assert.equal(out[0].actorId, 'maya');
  assert.equal(out[0].excerpt, '8.0 from your taste twin · 88% match');
  assert.equal(out[0].itemId, 'newer-8');
  assert.equal(out[0].createdAt, '2026-07-17T10:00:00Z');
});

test('tasteTwinNotifications skips items the viewer already rated', () => {
  const twin = friend('maya', 88, [rating('heard-it', 9, '2026-07-16T10:00:00Z')]);
  assert.deepEqual(tasteTwinNotifications([twin], new Set(['heard-it']), NOW), []);
});

test('tasteTwinNotifications caps the list after a logging spree', () => {
  const twin = friend(
    'maya',
    88,
    [1, 2, 3, 4, 5].map((n) => rating(`r${n}`, 9, `2026-07-1${n}T00:00:00Z`)),
  );
  const out = tasteTwinNotifications([twin], new Set(), NOW);
  assert.equal(out.length, 3);
  assert.equal(out[0].subject, 'r5'); // newest kept
});

test('tasteTwinNotifications only ever pings about the one twin', () => {
  const twin = friend('maya', 88, [rating('a', 9, '2026-07-16T00:00:00Z')]);
  const runnerUp = friend('devon', 70, [rating('b', 10, '2026-07-16T00:00:00Z')]);
  const out = tasteTwinNotifications([twin, runnerUp], new Set(), NOW);
  assert.deepEqual(out.map((n) => n.actorId), ['maya']);
});

test('tasteTwinNotifications maps song type and skips artist entries', () => {
  const twin = friend('maya', 88, [
    rating('s', 9, '2026-07-16T00:00:00Z', 'song'),
    rating('art', 9, '2026-07-16T00:00:00Z', 'artist'),
  ]);
  const out = tasteTwinNotifications([twin], new Set(), NOW);
  assert.deepEqual(out.map((n) => [n.itemId, n.itemType]), [['s', 'song']]);
});
