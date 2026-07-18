import assert from 'node:assert/strict';
import { test } from 'node:test';

import { applyToggle } from './apply';
import type { LikeSummary } from './types';

const summary = (count: number, likedByMe = false): LikeSummary => ({
  targetId: 'a',
  count,
  likedByMe,
});

test('a like that inserted a row adds one', () => {
  assert.deepEqual(applyToggle(summary(4), { likedByMe: true, delta: 1 }), {
    targetId: 'a',
    count: 5,
    likedByMe: true,
  });
});

test('an unlike that removed a row subtracts one', () => {
  assert.deepEqual(applyToggle(summary(5, true), { likedByMe: false, delta: -1 }), {
    targetId: 'a',
    count: 4,
    likedByMe: false,
  });
});

test('a call that changed nothing moves the count but not the state', () => {
  // The race: a second unlike whose delete removed no rows. It must still flip
  // likedByMe (the end state is genuinely "not liked") without double-counting.
  assert.deepEqual(applyToggle(summary(4, true), { likedByMe: false, delta: 0 }), {
    targetId: 'a',
    count: 4,
    likedByMe: false,
  });
});

test('racing unlikes subtract once, not once per call — the -13 regression', () => {
  // Thirteen rapid taps on a liked item: one delete removes the row, the other
  // twelve remove nothing. The old code applied -1 per call and rendered -13.
  const results = [
    { likedByMe: false as const, delta: -1 as const },
    ...Array.from({ length: 12 }, () => ({ likedByMe: false as const, delta: 0 as const })),
  ];
  const final = results.reduce(applyToggle, summary(1, true));

  assert.equal(final.count, 0);
  assert.equal(final.likedByMe, false);
});

test('the count never goes negative', () => {
  // Belt and braces: the store seeds a summary at 0 before the real count
  // loads, so a toggle resolving mid-load must not render a negative number.
  assert.equal(applyToggle(summary(0, true), { likedByMe: false, delta: -1 }).count, 0);
});
