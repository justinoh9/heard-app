/**
 * Moderation context: who the viewer has blocked, and what they've reported.
 *
 * Mounted **above** the social bridge in `_layout.tsx`, because the social
 * store filters its feed and directory through `blockedIds`. That ordering is
 * load-bearing: filtering in the stores rather than the screens means a new
 * surface can't forget to hide a blocked user.
 */

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { useAuth } from '@/auth/store';

import { reportKey } from './filter';
import { moderationBackend } from './provider';
import type { NewReport, ReportReason, ReportTargetType } from './types';

export interface ModerationApi {
  /** User ids the viewer has blocked. Empty for guests. */
  blockedIds: Set<string>;
  isBlocked: (userId: string) => boolean;
  /**
   * Block someone: hide them everywhere and sever the follow both ways, so
   * they stop seeing the viewer's activity too.
   */
  block: (userId: string) => void;
  unblock: (userId: string) => void;
  /** True once the viewer has reported this exact target. */
  hasReported: (targetType: ReportTargetType, targetId: string) => boolean;
  /** File a report. Re-reporting the same target is a no-op. */
  report: (input: Omit<NewReport, 'reporterId'>) => Promise<void>;
  /**
   * Whether to show the report-review entrance. A UI hint only — the database
   * decides what an admin can actually read (0023). Flipping this in devtools
   * gets you an empty screen, not someone else's reports.
   */
  isAdmin: boolean;
}

export const ModerationContext = createContext<ModerationApi | null>(null);

/** A guest has nothing blocked and can't report — a stable empty value. */
const EMPTY: Set<string> = new Set();

export function useModerationState(): ModerationApi {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const [blockedIds, setBlockedIds] = useState<Set<string>>(EMPTY);
  const [reported, setReported] = useState<Set<string>>(EMPTY);
  const [isAdmin, setIsAdmin] = useState(false);

  const load = useCallback(() => {
    if (!userId) {
      setBlockedIds(EMPTY);
      setReported(EMPTY);
      setIsAdmin(false);
      return;
    }
    let cancelled = false;
    Promise.all([
      moderationBackend.blockedBy(userId),
      moderationBackend.reportedKeys(userId),
      // Never rejects (the backend swallows a missing-function error into false),
      // so a project that hasn't run 0023 just doesn't show the entrance.
      moderationBackend.isAdmin(),
    ])
      .then(([blocked, keys, admin]) => {
        if (cancelled) return;
        setBlockedIds(new Set(blocked));
        setReported(new Set(keys));
        setIsAdmin(admin);
      })
      .catch((e: unknown) => {
        // Fail open on the *read*: an unreachable block list shouldn't lock the
        // app. The user sees an unfiltered feed for this session, which is the
        // status quo ante — but the block rows are untouched, so a reload
        // restores them.
        if (!cancelled) console.warn('[moderation] load failed:', e);
      });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  useEffect(() => load(), [load]);

  return useMemo<ModerationApi>(
    () => ({
      blockedIds,
      isBlocked: (id) => blockedIds.has(id),
      block: (targetId) => {
        if (!userId || targetId === userId) return;
        // Optimistic: they vanish from every surface on the next render.
        setBlockedIds((prev) => new Set(prev).add(targetId));
        moderationBackend
          .setBlocked(userId, targetId, true)
          .then(() => moderationBackend.severFollows(userId, targetId))
          .catch((e: unknown) => {
            console.warn('[moderation] block failed:', e);
            // Roll back — a block that didn't persist must not look like it did.
            setBlockedIds((prev) => {
              const next = new Set(prev);
              next.delete(targetId);
              return next;
            });
          });
      },
      unblock: (targetId) => {
        if (!userId) return;
        const had = blockedIds.has(targetId);
        setBlockedIds((prev) => {
          const next = new Set(prev);
          next.delete(targetId);
          return next;
        });
        moderationBackend.setBlocked(userId, targetId, false).catch((e: unknown) => {
          console.warn('[moderation] unblock failed:', e);
          if (had) setBlockedIds((prev) => new Set(prev).add(targetId));
        });
      },
      hasReported: (targetType, targetId) => reported.has(reportKey(targetType, targetId)),
      report: async (input) => {
        if (!userId) return;
        await moderationBackend.report({ ...input, reporterId: userId });
        setReported((prev) => new Set(prev).add(reportKey(input.targetType, input.targetId)));
      },
      isAdmin,
    }),
    [blockedIds, reported, userId, isAdmin],
  );
}

export function useModeration(): ModerationApi {
  const ctx = useContext(ModerationContext);
  if (!ctx) throw new Error('useModeration must be used within ModerationContext.Provider');
  return ctx;
}

export type { ReportReason, ReportTargetType };
