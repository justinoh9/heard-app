/**
 * The badge announcer (Growth playbook: Social Currency + Public): watches the
 * computed badge set and publishes a 'badge' feed event when a new one is
 * earned, so achievements are visible instead of silent. Renders nothing;
 * mounted once in _layout below every store it reads.
 *
 * The publish is best-effort through `useSocial().publish` — on a project that
 * hasn't run 0029 the insert bounces off the feed_events type check and the
 * app carries on (the seen set is stamped first, so it never retries into
 * spam). All the announce-or-baseline reasoning lives in pure, unit-tested
 * `announce.ts`; the settle window guards against reading "my stores finished
 * hydrating" as "I just earned six badges".
 */

import { useEffect, useRef } from 'react';

import { useAuth } from '@/auth/store';
import { useConcerts } from '@/concerts/store';
import { useRatings } from '@/data/store';
import { usePlaylists } from '@/playlists/store';
import { useQueue } from '@/queue/store';
import { useSocial } from '@/social/store';
import { useStreaks } from '@/streaks/store';

import { planAnnouncements } from './announce';
import { badgeInputsFromRanked, computeBadges } from './compute';
import { getSeenBadges, setSeenBadges } from './seen';

/** How long after the flagged stores finish loading before earns announce.
 *  Covers the stores without loading flags (playlists, streaks). */
const SETTLE_MS = 8000;

export function BadgeAnnouncer(): null {
  const { user } = useAuth();
  const { ranked, loading: ratingsLoading } = useRatings();
  const { concerts, loading: concertsLoading } = useConcerts();
  const { items: queueItems, loading: queueLoading } = useQueue();
  const { playlists } = usePlaylists();
  const { longest } = useStreaks();
  const { publish } = useSocial();

  const userId = user?.id ?? null;
  const loading = ratingsLoading || concertsLoading || queueLoading;

  // When the flagged stores last became ready — the settle clock. Reset on
  // user change so a sign-out/sign-in starts a fresh window.
  const readyAtRef = useRef<number | null>(null);
  useEffect(() => {
    readyAtRef.current = null;
  }, [userId]);

  // Serialize passes: each awaits the seen read before writing it back, and
  // overlapping passes could otherwise announce the same earn twice.
  const busyRef = useRef(false);

  useEffect(() => {
    if (!userId || loading) return;
    if (readyAtRef.current === null) readyAtRef.current = Date.now();
    const settled = Date.now() - readyAtRef.current >= SETTLE_MS;

    const badges = computeBadges(
      badgeInputsFromRanked(ranked, {
        concertCount: concerts.length,
        longestStreak: longest,
        listCount: playlists.length,
        queueCount: queueItems.length,
      }),
    );

    if (busyRef.current) return;
    busyRef.current = true;
    void (async () => {
      try {
        const seen = await getSeenBadges(userId);
        const plan = planAnnouncements(seen, badges, settled);
        const changed =
          seen === null || plan.seen.length !== seen.length;
        // Stamp seen BEFORE publishing: a failed publish (offline, pre-0029
        // backend) must skip the announcement, not queue it for a spammy retry.
        if (changed) await setSeenBadges(userId, plan.seen);
        for (const b of plan.announce) {
          publish('badge', { badgeId: b.id, title: b.title });
        }
      } finally {
        busyRef.current = false;
      }
    })();
  }, [userId, loading, ranked, concerts, queueItems, playlists, longest, publish]);

  return null;
}
