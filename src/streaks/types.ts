/**
 * Streaks seam. Unlike ratings/feed (plain in-memory `useState`, reset on
 * reload), streak state is persisted to `AsyncStorage` (see store.tsx) —
 * a "days in a row" counter that resets on every app open is meaningless.
 */

export interface StreakState {
  /** Consecutive days of activity as of `lastActiveDate`. */
  current: number;
  /** Best `current` has ever been. */
  longest: number;
  /** 'YYYY-MM-DD' of the last recorded activity, or null before any activity. */
  lastActiveDate: string | null;
  /** Deduped 'YYYY-MM-DD' history, most recent last, capped for the calendar view. */
  activeDates: string[];
}

export const EMPTY_STREAK_STATE: StreakState = {
  current: 0,
  longest: 0,
  lastActiveDate: null,
  activeDates: [],
};
