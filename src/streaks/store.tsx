/**
 * Streaks context: persists per-user streak state to AsyncStorage (mirrors
 * src/auth/local-backend.ts's storage pattern) and exposes it via useStreaks().
 * commitPlacement (src/data/store.ts) and postDrop (src/feed/store.tsx) both
 * call recordActivity() directly — see SPEC discussion in the streaks plan for
 * why this is a direct cross-seam import rather than an inferred side effect.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';

import { useAuth } from '@/auth/store';

import { displayStreak, parseStreakState, recordActivity as applyActivity, todayKey } from './logic';
import { EMPTY_STREAK_STATE, type StreakState } from './types';

export interface StreaksApi {
  /** Consecutive days of activity as of today (0 if the streak has lapsed). */
  current: number;
  longest: number;
  /** Deduped 'YYYY-MM-DD' history, most recent last. */
  activeDates: string[];
  /** Mark today as active. No-op if called more than once in a day. */
  recordActivity: () => void;
}

export const StreaksContext = createContext<StreaksApi | null>(null);

function storageKey(userId: string): string {
  return `heard.streaks.${userId}`;
}

function persist(userId: string, next: StreakState): void {
  AsyncStorage.setItem(storageKey(userId), JSON.stringify(next)).catch((e: unknown) => {
    // Nothing useful to tell the user mid-log; the next activity rewrites the
    // whole state anyway, so a dropped write costs at most today's tick.
    console.warn('[streaks] could not save streak state:', e);
  });
}

export function useStreaksState(): StreaksApi {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const [state, setState] = useState<StreakState>(EMPTY_STREAK_STATE);
  /**
   * Which user's stored state `state` actually reflects. Until the read comes
   * back, `state` is a placeholder — and writing a placeholder over a real
   * streak erases it. Logging a rating on a cold start beats AsyncStorage
   * comfortably, so this is an ordinary path, not a rare race.
   */
  const hydratedFor = useRef<string | null>(null);
  /** Activity that happened before hydration finished, applied once it does. */
  const pendingActivity = useRef(false);

  useEffect(() => {
    hydratedFor.current = null;
    if (!userId) {
      setState(EMPTY_STREAK_STATE);
      return;
    }
    let cancelled = false;
    const hydrate = (loaded: StreakState) => {
      if (cancelled) return;
      // Don't drop a tick that landed while we were reading — replay it.
      const next = pendingActivity.current ? applyActivity(loaded, todayKey()) : loaded;
      pendingActivity.current = false;
      setState(next);
      hydratedFor.current = userId;
      if (next !== loaded) persist(userId, next);
    };
    AsyncStorage.getItem(storageKey(userId))
      .then((raw) => hydrate(parseStreakState(raw)))
      // Unreadable storage still hydrates: better to start a fresh streak than
      // to leave recordActivity permanently disabled and log nothing at all.
      .catch(() => hydrate(EMPTY_STREAK_STATE));
    return () => {
      cancelled = true;
    };
  }, [userId]);

  return useMemo<StreaksApi>(() => {
    const today = todayKey();
    return {
      current: displayStreak(state, today),
      longest: state.longest,
      activeDates: state.activeDates,
      recordActivity: () => {
        if (!userId) return;
        if (hydratedFor.current !== userId) {
          pendingActivity.current = true; // replayed by hydrate()
          return;
        }
        // Computed outside setState: an updater must stay pure (React may call
        // it twice), and same-day calls are idempotent, so `state` is enough.
        const next = applyActivity(state, todayKey());
        if (next === state) return;
        setState(next);
        persist(userId, next);
      },
    };
  }, [state, userId]);
}

export function useStreaks(): StreaksApi {
  const ctx = useContext(StreaksContext);
  if (!ctx) throw new Error('useStreaks must be used within StreaksContext.Provider');
  return ctx;
}
