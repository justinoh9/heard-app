/**
 * Concerts context: the viewer's shows (logged + tagged-at) and the log
 * action. Logging emits a 'concert' feed event (blueprint invariant: every
 * log path feeds the activity feed) and counts as streak activity.
 */

import { createContext, useContext, useEffect, useMemo, useState } from 'react';

import { analyticsBackend } from '@/analytics/provider';
import { useAuth } from '@/auth/store';
import { useSocial } from '@/social/store';
import { useStreaks } from '@/streaks/store';

import { concertsBackend } from './provider';
import type { Concert, NewConcert } from './types';

export interface ConcertsApi {
  /** The viewer's shows (logged or tagged at, any status), newest first. */
  concerts: Concert[];
  loading: boolean;
  /**
   * Log a show or add a wishlist entry. Optimistic; an *attended* log also
   * publishes the feed event + streak tick, a wishlist add stays silent
   * (private intent, like the listen queue).
   */
  logConcert: (input: Omit<NewConcert, 'userId'>) => void;
  /** Promote the viewer's own wishlist entry to an attended show. */
  markAttended: (concertId: string) => void;
  /** Delete the viewer's own show. */
  removeConcert: (concertId: string) => void;
  /** Confirm the viewer's pending tag at a show. */
  confirmTag: (concertId: string) => void;
  /** Decline (remove) the viewer's tag at a show. */
  declineTag: (concertId: string) => void;
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
          id: `pending-${Date.now()}`,
          userId,
          artistName: draft.artistName,
          artistId: draft.artistId,
          venue: draft.venue,
          city: draft.city,
          showDate: draft.showDate,
          score: draft.score,
          notes: draft.notes,
          status: draft.status,
          tags: draft.taggedUserIds.map((id) => ({ userId: id, status: 'pending' })),
          createdAt: new Date().toISOString(),
        };
        setConcerts((prev) => [provisional, ...prev]);
        // A wishlist add is private intent — no feed event, no streak tick, and
        // no analytics either: this measures the concert layer being used, and
        // wanting to go somewhere isn't going.
        if (draft.status === 'attended') {
          streaks.recordActivity();
          void analyticsBackend.track(userId, 'concert_logged', {
            // Whether the venue was pinned tells us if the map is earning its
            // keep — a bare count can't distinguish a dot from a typed string.
            mapped: typeof draft.lat === 'number' && typeof draft.lng === 'number',
          });
          social.publish('concert', {
            title: draft.artistName,
            artist:
              draft.venue && draft.city
                ? `${draft.venue} · ${draft.city}`
                : draft.venue || draft.city,
            score: draft.score,
          });
        }
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
      markAttended: (concertId) => {
        if (!userId) return;
        setConcerts((prev) =>
          prev.map((c) => (c.id === concertId ? { ...c, status: 'attended' } : c)),
        );
        streaks.recordActivity();
        const show = concerts.find((c) => c.id === concertId);
        if (show) {
          social.publish('concert', {
            title: show.artistName,
            artist:
              show.venue && show.city ? `${show.venue} · ${show.city}` : show.venue || show.city,
            score: show.score,
          });
        }
        concertsBackend.markAttended(concertId).catch((e: unknown) => {
          console.warn('[concerts] markAttended failed:', e);
        });
      },
      removeConcert: (concertId) => {
        setConcerts((prev) => prev.filter((c) => c.id !== concertId));
        concertsBackend.remove(concertId).catch((e: unknown) => {
          console.warn('[concerts] remove failed:', e);
        });
      },
      confirmTag: (concertId) => {
        if (!userId) return;
        setConcerts((prev) =>
          prev.map((c) =>
            c.id === concertId
              ? {
                  ...c,
                  tags: c.tags.map((t) =>
                    t.userId === userId ? { ...t, status: 'confirmed' } : t,
                  ),
                }
              : c,
          ),
        );
        concertsBackend.confirmTag(concertId, userId).catch((e: unknown) => {
          console.warn('[concerts] confirmTag failed:', e);
        });
      },
      declineTag: (concertId) => {
        if (!userId) return;
        setConcerts((prev) =>
          prev.map((c) =>
            c.id === concertId
              ? { ...c, tags: c.tags.filter((t) => t.userId !== userId) }
              : c,
          ),
        );
        concertsBackend.declineTag(concertId, userId).catch((e: unknown) => {
          console.warn('[concerts] declineTag failed:', e);
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
