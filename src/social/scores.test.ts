import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  formatCount,
  friendScoresFor,
  globalStatsFor,
  scoreBreakdown,
} from './scores';

const ITEM = 'release-group-abc-123';

test('friendScoresFor is deterministic for the same item', () => {
  const a = friendScoresFor(ITEM);
  const b = friendScoresFor(ITEM);
  assert.deepEqual(a, b);
});

test('friend scores fall in the pleasant 6.5–9.5 band', () => {
  for (const f of friendScoresFor(ITEM)) {
    assert.ok(f.score >= 6.5 && f.score <= 9.5, `${f.username} scored ${f.score}`);
  }
});

test('breakdowns vary across items (not a global constant)', () => {
  const ids = Array.from({ length: 12 }, (_, i) => `release-group-${i}`);
  const distinct = new Set(ids.map((id) => JSON.stringify(scoreBreakdown(id))));
  assert.ok(distinct.size > 1, 'expected breakdowns to differ across items');
});

test('globalStatsFor is deterministic and in range', () => {
  const a = globalStatsFor(ITEM);
  const b = globalStatsFor(ITEM);
  assert.deepEqual(a, b);
  assert.ok(a.avg >= 6 && a.avg <= 8.8);
  assert.ok(a.count >= 200 && a.count <= 10000);
});

test('scoreBreakdown averages friends and carries your score through', () => {
  const bd = scoreBreakdown(ITEM, 8.2);
  assert.equal(bd.you, 8.2);
  if (bd.friends.length) {
    const mean = bd.friends.reduce((s, f) => s + f.score, 0) / bd.friends.length;
    assert.equal(bd.friendsAvg, Math.round(mean * 10) / 10);
  } else {
    assert.equal(bd.friendsAvg, undefined);
  }
});

test('scoreBreakdown without your score leaves you undefined', () => {
  assert.equal(scoreBreakdown(ITEM).you, undefined);
});

test('formatCount abbreviates thousands', () => {
  assert.equal(formatCount(842), '842');
  assert.equal(formatCount(1290), '1.3k');
  assert.equal(formatCount(2000), '2k');
});
