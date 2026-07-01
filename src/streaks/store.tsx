/**
 * Streaks context: persists per-user streak state to AsyncStorage (mirrors
 * src/auth/local-backend.ts's storage pattern) and exposes it via useStreaks().
 * commitPlacement (src/data/store.ts) and postDrop (src/feed/store.tsx) both
 * call recordActivity() directly — see SPEC discussion in the streaks plan for
 * why this is a direct cross-seam import rather than an inferred side effect.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useContext, useEffect, useMemo, useState } from 'react';

import { useAuth } from '@/auth/store';

import { displayStreak, recordActivity as applyActivity, todayKey } from './logic';
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

export function useStreaksState(): StreaksApi {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const [state, setState] = useState<StreakState>(EMPTY_STREAK_STATE);

  useEffect(() => {
    if (!userId) {
      setState(EMPTY_STREAK_STATE);
      return;
    }
    let cancelled = false;
    AsyncStorage.getItem(storageKey(userId)).then((raw) => {
      if (cancelled) return;
      setState(raw ? (JSON.parse(raw) as StreakState) : EMPTY_STREAK_STATE);
    });
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
        setState((prev) => {
          const next = applyActivity(prev, todayKey());
          AsyncStorage.setItem(storageKey(userId), JSON.stringify(next));
          return next;
        });
      },
    };
  }, [state, userId]);
}

export function useStreaks(): StreaksApi {
  const ctx = useContext(StreaksContext);
  if (!ctx) throw new Error('useStreaks must be used within StreaksContext.Provider');
  return ctx;
}
