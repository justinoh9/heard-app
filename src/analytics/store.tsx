/**
 * Analytics context: `track` an event as the signed-in viewer.
 *
 * Guests are a no-op, not because tracking them is hard but because 0027's
 * insert policy requires `auth.uid()::text = user_id` — a guest event has no
 * author and would be rejected. Dropping it here keeps the promise on the privacy
 * page ("we don't track signed-out visitors") true in the code rather than in the
 * comments.
 *
 * `app_opened` fires from here rather than from a screen: it is a property of the
 * session, and any screen that owned it would be quietly wrong the moment the
 * first thing a user saw changed.
 */

import { createContext, useContext, useEffect, useMemo, useRef } from 'react';

import { useAuth } from '@/auth/store';

import { analyticsBackend } from './provider';
import type { AnalyticsEventName, AnalyticsProps } from './types';

export interface AnalyticsApi {
  /**
   * Record an event. Never throws and never needs awaiting — a failed telemetry
   * write must not be able to fail the action that triggered it.
   */
  track: (name: AnalyticsEventName, props?: AnalyticsProps) => void;
}

export const AnalyticsContext = createContext<AnalyticsApi | null>(null);

export function useAnalyticsState(): AnalyticsApi {
  const { user, status } = useAuth();
  const userId = user?.id ?? null;

  /**
   * One `app_opened` per signed-in session, not one per render or one per auth
   * state change. Without the guard, a token refresh would look like a return
   * visit and D7 retention would read high for a reason nobody could find.
   */
  const openedFor = useRef<string | null>(null);
  useEffect(() => {
    if (status !== 'authed' || !userId) return;
    if (openedFor.current === userId) return;
    openedFor.current = userId;
    void analyticsBackend.track(userId, 'app_opened');
  }, [status, userId]);

  return useMemo<AnalyticsApi>(
    () => ({
      track: (name, props) => {
        if (!userId) return;
        void analyticsBackend.track(userId, name, props);
      },
    }),
    [userId],
  );
}

export function useAnalytics(): AnalyticsApi {
  const ctx = useContext(AnalyticsContext);
  if (!ctx) throw new Error('useAnalytics must be used within AnalyticsContext.Provider');
  return ctx;
}
