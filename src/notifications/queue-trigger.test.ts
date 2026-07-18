import assert from 'node:assert/strict';
import { test } from 'node:test';

import { queueTriggerNotifications, type QueueTriggerFriend } from './queue-trigger';
import type { FriendRating } from '@/recommendations/types';
import type { Item, ItemType } from '@/ranking/types';

const NOW = new Date('2026-07-18T12:00:00Z');

const item = (id: string, type: ItemType = 'album'): Item => ({ id, type, title: id, artist: 'x' });
const rating = (id: string, score: number, ratedAt?: string, type?: ItemType): FriendRating => ({
  item: item(id, type),
  score,
  tiebreak: 0,
  ratedAt,
});
const friend = (userId: string, ratings: FriendRating[]): QueueTriggerFriend => ({
  userId,
  userName: userId,
  ratings,
});

test('pings recent friend ratings of queued items, newest first', () => {
  const out = queueTriggerNotifications(
    [
      friend('maya', [
        rating('queued-a', 6.5, '2026-07-16T10:00:00Z'),
        rating('not-queued', 9, '2026-07-16T10:00:00Z'),
        rating('queued-old', 9, '2026-01-01T00:00:00Z'), // outside the window
      ]),
      friend('devon', [rating('queued-b', 8, '2026-07-17T10:00:00Z')]),
    ],
    new Set(['queued-a', 'queued-b', 'queued-old']),
    NOW,
  );
  assert.deepEqual(out.map((n) => n.subject), ['queued-b', 'queued-a']);
  assert.equal(out[0].kind, 'queue');
  assert.equal(out[0].actorId, 'devon');
  assert.equal(out[1].excerpt, "6.5 — it's on your want-to-listen list");
  assert.equal(out[1].itemId, 'queued-a');
});

test('any score pings — a queued item is pre-declared interest, not a taste bar', () => {
  const out = queueTriggerNotifications(
    [friend('maya', [rating('q', 3.1, '2026-07-16T10:00:00Z')])],
    new Set(['q']),
    NOW,
  );
  assert.equal(out.length, 1);
});

test('one ping per item — the freshest friend rating wins', () => {
  const out = queueTriggerNotifications(
    [
      friend('maya', [rating('q', 7, '2026-07-15T00:00:00Z')]),
      friend('devon', [rating('q', 9, '2026-07-16T00:00:00Z')]),
    ],
    new Set(['q']),
    NOW,
  );
  assert.equal(out.length, 1);
  assert.equal(out[0].actorName, 'devon');
});

test('caps the list and drops undated ratings', () => {
  const ratings = [1, 2, 3, 4, 5].map((n) => rating(`q${n}`, 8, `2026-07-1${n}T00:00:00Z`));
  const out = queueTriggerNotifications(
    [friend('maya', [...ratings, rating('q-undated', 9)])],
    new Set(['q1', 'q2', 'q3', 'q4', 'q5', 'q-undated']),
    NOW,
  );
  assert.equal(out.length, 3);
  assert.equal(out[0].subject, 'q5');
});

test('an empty queue produces nothing', () => {
  const out = queueTriggerNotifications(
    [friend('maya', [rating('a', 9, '2026-07-16T00:00:00Z')])],
    new Set(),
    NOW,
  );
  assert.deepEqual(out, []);
});
