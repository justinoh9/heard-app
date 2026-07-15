import assert from 'node:assert/strict';
import { test } from 'node:test';

import { badgeLabel, mergeNotifications, unreadCount } from './merge';
import type { AppNotification } from './types';

const n = (id: string, createdAt: string): AppNotification => ({
  id,
  kind: 'follow',
  actorId: `user-${id}`,
  actorName: id,
  createdAt,
});

test('mergeNotifications sorts newest first across sources', () => {
  const a = [n('a', '2026-07-01T00:00:00Z'), n('c', '2026-07-03T00:00:00Z')];
  const b = [n('b', '2026-07-02T00:00:00Z')];
  assert.deepEqual(
    mergeNotifications(a, b).map((x) => x.id),
    ['c', 'b', 'a'],
  );
});

test('mergeNotifications breaks ties by id', () => {
  const same = '2026-07-01T00:00:00Z';
  assert.deepEqual(
    mergeNotifications([n('z', same), n('a', same)]).map((x) => x.id),
    ['a', 'z'],
  );
});

test('unreadCount: null last-seen means everything is unread', () => {
  const list = [n('a', '2026-07-01T00:00:00Z'), n('b', '2026-07-02T00:00:00Z')];
  assert.equal(unreadCount(list, null), 2);
});

test('unreadCount: only items strictly newer than last-seen count', () => {
  const list = [
    n('a', '2026-07-01T00:00:00Z'),
    n('b', '2026-07-02T00:00:00Z'),
    n('c', '2026-07-03T00:00:00Z'),
  ];
  assert.equal(unreadCount(list, '2026-07-02T00:00:00Z'), 1); // only c
  assert.equal(unreadCount(list, '2026-07-03T00:00:00Z'), 0);
});

test('badgeLabel caps at 9+', () => {
  assert.equal(badgeLabel(0), '');
  assert.equal(badgeLabel(5), '5');
  assert.equal(badgeLabel(9), '9');
  assert.equal(badgeLabel(10), '9+');
  assert.equal(badgeLabel(250), '9+');
});
