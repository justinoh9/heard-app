/**
 * Concerts context: the viewer's shows (logged + tagged-at) and the log
 * action. Logging emits a 'concert' feed event (blueprint invariant: every
 * log path feeds the activity feed) and counts as streak activity.
 */

import { createContext, useContext, useEffect, useMemo, useState } from 'react';

import { useAuth } from '@/auth/store';
import { useSocial } from '@/social/store';
import { useStreaks } from '@/streaks/store';

import { concertsBackend } from './provider';
import type { Concert, NewConcert } from './types';

export interface ConcertsApi {
  /** The viewer's shows (logged or tagged at), newest first. */
  concerts: Concert[];
  loading: boolean;
  /** Log a show. Optimistic; also publishes the feed event + streak tick. */
  logConcert: (input: Omit<NewConcert, 'userId'>) => void;
}

export const ConcertsContext = createContext<ConcertsApi | null>(null);

export function useConcertsState(): ConcertsApi {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const [concerts, setConcerts] = useState<Concert[]>([]);
  const [loading, setLoading] = useState(true);
  const social = useSocial();
  const streaks = useStreaks();

  useEffect(() => {
    if (!userId) {
      setConcerts([]);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    concertsBackend
      .listFor(userId)
      .then((list) => {
        if (!cancelled) setConcerts(list);
      })
      .catch((e: unknown) => console.warn('[concerts] load failed:', e))
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  return useMemo<ConcertsApi>(
    () => ({
      concerts,
      loading,
      logConcert: (input) => {
        if (!userId) return;
        const draft: NewConcert = { ...input, userId };
        // Optimistic row; replaced by the stored one when the write returns.
        const provisional: Concert = {
          ...draft,
          id: `pending-${Date.now()}`,
          createdAt: new Date().toISOString(),
        };
        setConcerts((prev) => [provisional, ...prev]);
        streaks.recordActivity();
        social.publish('concert', {
          title: draft.artistName,
          artist: draft.venue && draft.city ? `${draft.venue} · ${draft.city}` : draft.venue || draft.city,
          score: draft.score,
        });
        concertsBackend
          .add(draft)
          .then((stored) =>
            setConcerts((prev) => prev.map((c) => (c.id === provisional.id ? stored : c))),
          )
          .catch((e: unknown) => {
            console.warn('[concerts] save failed:', e);
            setConcerts((prev) => prev.filter((c) => c.id !== provisional.id));
          });
      },
    }),
    [concerts, loading, userId, social, streaks],
  );
}

export function useConcerts(): ConcertsApi {
  const ctx = useContext(ConcertsContext);
  if (!ctx) throw new Error('useConcerts must be used within ConcertsContext.Provider');
  return ctx;
}
