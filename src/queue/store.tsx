/**
 * Want-to-listen queue context: the viewer's bookmarked songs/albums and the
 * add/remove toggle. Optimistic like the other collection stores; hydrates on
 * sign-in. No feed event — a private listen-later list is intent, not activity
 * (it becomes public only as a profile count / list).
 */

import { createContext, useContext, useEffect, useMemo, useState } from 'react';

import { useAuth } from '@/auth/store';

import { queueBackend } from './provider';
import type { QueueInput, QueueItem } from './types';

export interface QueueApi {
  items: QueueItem[];
  loading: boolean;
  /** True when `itemId` is bookmarked. */
  isQueued: (itemId: string) => boolean;
  /** Bookmark, or remove if already queued. No-op for signed-out viewers. */
  toggle: (input: Omit<QueueInput, 'userId'>) => void;
}

export const QueueContext = createContext<QueueApi | null>(null);

export function useQueueState(): QueueApi {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const [items, setItems] = useState<QueueItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) {
      setItems([]);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    queueBackend
      .listFor(userId)
      .then((list) => {
        if (!cancelled) setItems(list);
      })
      .catch((e: unknown) => console.warn('[queue] load failed:', e))
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  return useMemo<QueueApi>(() => {
    const queuedIds = new Set(items.map((i) => i.itemId));
    return {
      items,
      loading,
      isQueued: (itemId) => queuedIds.has(itemId),
      toggle: (input) => {
        if (!userId) return;
        if (queuedIds.has(input.itemId)) {
          // Optimistic remove; restore on failure.
          const removed = items.find((i) => i.itemId === input.itemId);
          setItems((prev) => prev.filter((i) => i.itemId !== input.itemId));
          queueBackend.remove(userId, input.itemId).catch((e: unknown) => {
            console.warn('[queue] remove failed:', e);
            if (removed) setItems((prev) => [removed, ...prev]);
          });
          return;
        }
        // Optimistic add; replaced by the stored row when the write returns.
        const provisional: QueueItem = {
          id: `pending-${Date.now()}`,
          itemId: input.itemId,
          type: input.type,
          title: input.title,
          artist: input.artist,
          artUrl: input.artUrl,
          createdAt: new Date().toISOString(),
        };
        setItems((prev) => [provisional, ...prev]);
        queueBackend
          .add({ ...input, userId })
          .then((stored) =>
            setItems((prev) => prev.map((i) => (i.id === provisional.id ? stored : i))),
          )
          .catch((e: unknown) => {
            console.warn('[queue] add failed:', e);
            setItems((prev) => prev.filter((i) => i.id !== provisional.id));
          });
      },
    };
  }, [items, loading, userId]);
}

export function useQueue(): QueueApi {
  const ctx = useContext(QueueContext);
  if (!ctx) throw new Error('useQueue must be used within QueueContext.Provider');
  return ctx;
}
