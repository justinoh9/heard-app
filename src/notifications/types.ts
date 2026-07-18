/**
 * Notifications (ROADMAP Phase 2). In-app first: derived at read time from the
 * existing tables (follows / comments / concert_tags) rather than a written
 * notifications table — no migration, no write-path hooks on every social
 * action. Screens talk to the `NotificationsBackend` seam (provider.ts):
 * Supabase when configured, an empty Local impl otherwise. "Unread" is a
 * device-local last-seen timestamp (see seen.ts). Push is a later slice.
 */

export type NotificationKind = 'follow' | 'comment' | 'tag' | 'twin' | 'queue';

export interface AppNotification {
  /** Stable id for keys/dedup. */
  id: string;
  kind: NotificationKind;
  /**
   * Who caused it, by id — the handle blocking filters on. Names aren't unique,
   * so this can't be `actorName`.
   */
  actorId: string;
  /** Who caused it (follower, commenter, or the friend who tagged you). */
  actorName: string;
  /** ISO timestamp, for ordering + unread comparison. */
  createdAt: string;
  /** comment/twin: the item title; tag: the artist name. */
  subject?: string;
  /** comment: a short excerpt of the body; twin: "9.2 · 88% match" context. */
  excerpt?: string;
  /** comment/twin: lets the row open the item page. */
  itemId?: string;
  itemType?: 'song' | 'album';
}

/** Thrown for expected persistence failures — UI-safe message. */
export class NotificationsError extends Error {}

export interface NotificationsBackend {
  /**
   * Recent notifications for a user, newest first. `myItemIds` are the ids of
   * items the user has rated — the scope for "someone commented on your music".
   */
  listFor(userId: string, myItemIds: string[]): Promise<AppNotification[]>;
}
