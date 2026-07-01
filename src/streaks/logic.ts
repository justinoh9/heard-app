/**
 * Pure streak transitions. Kept free of React/AsyncStorage so the day-boundary
 * math is unit-testable (logic.test.ts) the same way ranking/score are. The
 * persistence layer lives in store.tsx.
 */

import { EMPTY_STREAK_STATE, type StreakState } from './types';

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const MAX_ACTIVE_DATES = 90;

/** 'YYYY-MM-DD' for the given instant, in local time. */
export function todayKey(now: number = Date.now()): string {
  const d = new Date(now);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Whole-day gap between two 'YYYY-MM-DD' keys (positive when `key` is after `from`). */
function dayGap(from: string, key: string): number {
  return Math.round((Date.parse(`${key}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / MS_PER_DAY);
}

/**
 * Record activity on `key`. Same-day calls are idempotent. Exactly one day
 * after `lastActiveDate` extends the streak; any other gap (or the very first
 * activity) starts a new streak at 1.
 */
export function recordActivity(state: StreakState, key: string): StreakState {
  if (state.lastActiveDate === key) return state;

  const current = state.lastActiveDate !== null && dayGap(state.lastActiveDate, key) === 1 ? state.current + 1 : 1;
  const activeDates = [...state.activeDates, key].slice(-MAX_ACTIVE_DATES);

  return {
    current,
    longest: Math.max(state.longest, current),
    lastActiveDate: key,
    activeDates,
  };
}

/**
 * The streak to display "as of today," even without new activity: a gap of
 * more than one day since `lastActiveDate` means the streak has lapsed, even
 * though `state.current` won't reset until the next `recordActivity` call.
 */
export function displayStreak(state: StreakState, key: string): number {
  if (!state.lastActiveDate) return 0;
  return dayGap(state.lastActiveDate, key) <= 1 ? state.current : 0;
}

export { EMPTY_STREAK_STATE };
