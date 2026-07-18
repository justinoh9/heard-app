/**
 * Notifications store. Loads the derived notification feed for the signed-in
 * user and tracks the unread count against the device-local last-seen stamp.
 * Mounted below ratings in _layout (it needs the viewer's rated item ids to
 * scope "someone commented on your music"). The Feed bell reads `unread`; the
 * notifications screen reads `notifications` and calls `markAllSeen` on open.
 */

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

import { useAuth } from '@/auth/store';
import { useRatings } from '@/data/store';
import { hideBlocked } from '@/moderation/filter';
import { useModeration } from '@/moderation/store';
import { recommendationsBackend } from '@/recommendations/provider';
import type { FriendRatingList } from '@/recommendations/types';
import { compatibility } from '@/social/compatibility';
import { useSocial } from '@/social/store';

import { mergeNotifications, unreadCount } from './merge';
import { notificationsBackend } from './provider';
import { getLastSeen, markSeen } from './seen';
import { tasteTwinNotifications } from './taste-twin';
import type { AppNotification } from './types';

export interface NotificationsApi {
  notifications: AppNotification[];
  loading: boolean;
  /** Count newer than the last time the screen was opened. */
  unread: number;
  refresh: () => void;
  /** Stamp everything as seen now (clears the badge). */
  markAllSeen: () => void;
}

export const NotificationsContext = createContext<NotificationsApi | null>(null);

export function useNotificationsState(): NotificationsApi {
  const { user } = useAuth();
  const { ranked } = useRatings();
  const { blockedIds } = useModeration();
  const { followingIds, people } = useSocial();
  const userId = user?.id ?? null;

  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(false);
  const [lastSeen, setLastSeen] = useState<string | null>(null);

  // The taste-twin source (see taste-twin.ts): fetched once per follow set —
  // the same raw material and cadence as useRecommendations — then folded
  // locally so a new rating of ours drops its ping instantly.
  const [friendLists, setFriendLists] = useState<FriendRatingList[]>([]);
  const followKey = useMemo(() => [...followingIds].sort().join(','), [followingIds]);

  useEffect(() => {
    if (!userId || followKey === '') {
      setFriendLists([]);
      return;
    }
    let live = true;
    recommendationsBackend
      .friendLists(followKey.split(','))
      .then((res) => {
        if (live) setFriendLists(res);
      })
      .catch((e: unknown) => {
        console.warn('[notifications] twin source failed:', e);
        if (live) setFriendLists([]);
      });
    return () => {
      live = false;
    };
  }, [userId, followKey]);

  const twinNotifs = useMemo(() => {
    if (friendLists.length === 0) return [];
    const nameOf = new Map(people.map((p) => [p.userId, p.displayName]));
    const friends = friendLists.map((l) => ({
      userId: l.userId,
      userName: nameOf.get(l.userId) ?? 'A friend',
      compatibility: compatibility(ranked, l.ratings).percent,
      ratings: l.ratings,
    }));
    return tasteTwinNotifications(friends, new Set(ranked.map((r) => r.item.id)), new Date());
  }, [friendLists, people, ranked]);

  // Rated item ids scope the "comment on your music" source. Kept in a ref so
  // refresh() doesn't get a new identity on every rating (the badge tolerates
  // slight staleness; the screen re-refreshes on open).
  const itemIdsRef = useRef<string[]>([]);
  itemIdsRef.current = ranked.map((r) => r.item.id);

  const refresh = useCallback(() => {
    if (!userId) {
      setNotifications([]);
      setLastSeen(null);
      return;
    }
    setLoading(true);
    Promise.all([notificationsBackend.listFor(userId, itemIdsRef.current), getLastSeen(userId)])
      .then(([list, seen]) => {
        setNotifications(list);
        setLastSeen(seen);
      })
      .catch((e: unknown) => console.warn('[notifications] load failed:', e))
      .finally(() => setLoading(false));
  }, [userId]);

  useEffect(refresh, [refresh]);

  // A blocked user must not be able to ping you — their follow/comment/tag/twin
  // is dropped before it can reach the list *or* the bell's unread count.
  const visible = useMemo(
    () => hideBlocked(mergeNotifications(notifications, twinNotifs), blockedIds, (n) => [n.actorId]),
    [notifications, twinNotifs, blockedIds],
  );

  return useMemo<NotificationsApi>(
    () => ({
      notifications: visible,
      loading,
      unread: unreadCount(visible, lastSeen),
      refresh,
      markAllSeen: () => {
        if (!userId || visible.length === 0) return;
        // "Seen" = the newest notification's time, so nothing that arrived
        // before this open ever re-counts as unread.
        const newest = visible[0].createdAt;
        setLastSeen(newest);
        markSeen(userId, newest).catch(() => {});
      },
    }),
    [visible, loading, lastSeen, refresh, userId],
  );
}

export function useNotifications(): NotificationsApi {
  const ctx = useContext(NotificationsContext);
  if (!ctx) throw new Error('useNotifications must be used within NotificationsContext.Provider');
  return ctx;
}
