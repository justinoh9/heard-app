import assert from 'node:assert/strict';
import { test } from 'node:test';

import { displayStreak, recordActivity, todayKey } from './logic';
import { EMPTY_STREAK_STATE } from './types';

test('recordActivity starts a streak at 1 from empty state', () => {
  const next = recordActivity(EMPTY_STREAK_STATE, '2026-06-01');
  assert.equal(next.current, 1);
  assert.equal(next.longest, 1);
  assert.equal(next.lastActiveDate, '2026-06-01');
  assert.deepEqual(next.activeDates, ['2026-06-01']);
});

test('recordActivity is idempotent for the same day', () => {
  const once = recordActivity(EMPTY_STREAK_STATE, '2026-06-01');
  const twice = recordActivity(once, '2026-06-01');
  assert.equal(twice.current, 1);
  assert.deepEqual(twice.activeDates, ['2026-06-01']);
});

test('recordActivity extends the streak on the very next day', () => {
  let state = recordActivity(EMPTY_STREAK_STATE, '2026-06-01');
  state = recordActivity(state, '2026-06-02');
  state = recordActivity(state, '2026-06-03');
  assert.equal(state.current, 3);
  assert.equal(state.longest, 3);
  assert.deepEqual(state.activeDates, ['2026-06-01', '2026-06-02', '2026-06-03']);
});

test('recordActivity resets to 1 after a gap, but keeps the longest record', () => {
  let state = recordActivity(EMPTY_STREAK_STATE, '2026-06-01');
  state = recordActivity(state, '2026-06-02');
  state = recordActivity(state, '2026-06-03'); // current 3, longest 3
  state = recordActivity(state, '2026-06-10'); // gap -> reset
  assert.equal(state.current, 1);
  assert.equal(state.longest, 3);
});

test('recordActivity caps activeDates history to the most recent 90', () => {
  let state = EMPTY_STREAK_STATE;
  for (let i = 0; i < 95; i++) {
    const d = new Date(Date.UTC(2026, 0, 1) + i * 86400000);
    state = recordActivity(state, todayKey(d.getTime()));
  }
  assert.equal(state.activeDates.length, 90);
  assert.equal(state.current, 95);
});

test('displayStreak returns the current streak when active today or yesterday', () => {
  const state = recordActivity(EMPTY_STREAK_STATE, '2026-06-01');
  assert.equal(displayStreak(state, '2026-06-01'), 1);
  assert.equal(displayStreak(state, '2026-06-02'), 1);
});

test('displayStreak reports 0 once the streak has lapsed', () => {
  const state = recordActivity(EMPTY_STREAK_STATE, '2026-06-01');
  assert.equal(displayStreak(state, '2026-06-03'), 0);
});

test('displayStreak reports 0 for a fresh state', () => {
  assert.equal(displayStreak(EMPTY_STREAK_STATE, '2026-06-01'), 0);
});

test('todayKey formats a fixed instant as YYYY-MM-DD in local time', () => {
  const noon = new Date(2026, 5, 15, 12, 0, 0).getTime(); // June 15, 2026, local noon
  assert.equal(todayKey(noon), '2026-06-15');
});
