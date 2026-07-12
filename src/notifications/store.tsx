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

import { unreadCount } from './merge';
import { notificationsBackend } from './provider';
import { getLastSeen, markSeen } from './seen';
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
  const userId = user?.id ?? null;

  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(false);
  const [lastSeen, setLastSeen] = useState<string | null>(null);

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

  return useMemo<NotificationsApi>(
    () => ({
      notifications,
      loading,
      unread: unreadCount(notifications, lastSeen),
      refresh,
      markAllSeen: () => {
        if (!userId || notifications.length === 0) return;
        // "Seen" = the newest notification's time, so nothing that arrived
        // before this open ever re-counts as unread.
        const newest = notifications[0].createdAt;
        setLastSeen(newest);
        markSeen(userId, newest).catch(() => {});
      },
    }),
    [notifications, loading, lastSeen, refresh, userId],
  );
}

export function useNotifications(): NotificationsApi {
  const ctx = useContext(NotificationsContext);
  if (!ctx) throw new Error('useNotifications must be used within NotificationsContext.Provider');
  return ctx;
}
