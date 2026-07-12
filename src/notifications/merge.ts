/**
 * Pure notification helpers: merge the per-source lists into one newest-first
 * feed, and count unread against a last-seen timestamp. Framework-free so it
 * runs under the tsx node test runner.
 */

import type { AppNotification } from './types';

/** Merge sources into one list, newest first (ties broken by id for stability). */
export function mergeNotifications(...sources: AppNotification[][]): AppNotification[] {
  return sources
    .flat()
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt) || a.id.localeCompare(b.id));
}

/**
 * How many notifications are newer than the last time the user opened the
 * screen. A null last-seen (never opened) counts everything as unread.
 */
export function unreadCount(
  notifications: AppNotification[],
  lastSeen: string | null,
): number {
  if (!lastSeen) return notifications.length;
  return notifications.filter((n) => n.createdAt > lastSeen).length;
}

/** A capped badge label: 1–9 as-is, then "9+". Empty string when zero. */
export function badgeLabel(count: number): string {
  if (count <= 0) return '';
  return count > 9 ? '9+' : String(count);
}
