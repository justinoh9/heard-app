import assert from 'node:assert/strict';
import { test } from 'node:test';

import { planAnnouncements } from './announce';
import type { Badge } from './compute';

const badge = (id: string, earned: boolean): Badge => ({
  id,
  title: id,
  blurb: '',
  icon: 'ribbon',
  earned,
  have: earned ? 1 : 0,
  need: 1,
});

test('a null seen set records a baseline and announces nothing', () => {
  const plan = planAnnouncements(null, [badge('a', true), badge('b', false)], true);
  assert.deepEqual(plan.announce, []);
  assert.deepEqual(plan.seen, ['a']);
});

test('before settling, earns fold into seen silently', () => {
  const plan = planAnnouncements(['a'], [badge('a', true), badge('b', true)], false);
  assert.deepEqual(plan.announce, []);
  assert.deepEqual(plan.seen.sort(), ['a', 'b']);
});

test('a fresh earn after settling announces once', () => {
  const plan = planAnnouncements(['a'], [badge('a', true), badge('b', true)], true);
  assert.deepEqual(plan.announce.map((b) => b.id), ['b']);
  assert.deepEqual(plan.seen.sort(), ['a', 'b']);

  // The next pass, with the updated seen set, announces nothing.
  const next = planAnnouncements(plan.seen, [badge('a', true), badge('b', true)], true);
  assert.deepEqual(next.announce, []);
});

test('announcements cap per pass but everything is marked seen', () => {
  const earned = ['a', 'b', 'c', 'd', 'e'].map((id) => badge(id, true));
  const plan = planAnnouncements([], earned, true, 3);
  assert.equal(plan.announce.length, 3);
  assert.equal(plan.seen.length, 5); // the overflow never announces later either
});

test('an unsettled pass never shrinks the baseline (late-hydrating store)', () => {
  // Device knows b1..b3; at effect time the playlists store hasn't hydrated,
  // so only b1 computes as earned. The stored set must keep all three…
  const plan = planAnnouncements(['b1', 'b2', 'b3'], [badge('b1', true)], false);
  assert.deepEqual(plan.announce, []);
  assert.deepEqual(plan.seen.sort(), ['b1', 'b2', 'b3']);

  // …so that when the store catches up after settling, nothing re-announces.
  const later = planAnnouncements(
    plan.seen,
    ['b1', 'b2', 'b3'].map((id) => badge(id, true)),
    true,
  );
  assert.deepEqual(later.announce, []);
});

test('a seen badge whose metric dipped stays seen and never re-announces', () => {
  // Earned queue badge, then the user emptied their queue…
  const dipped = planAnnouncements(['q'], [badge('q', false)], true);
  assert.deepEqual(dipped.announce, []);
  assert.deepEqual(dipped.seen, ['q']); // union keeps it

  // …and re-filling the queue must not announce it again.
  const refilled = planAnnouncements(dipped.seen, [badge('q', true)], true);
  assert.deepEqual(refilled.announce, []);
});
