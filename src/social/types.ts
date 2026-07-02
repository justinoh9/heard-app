/**
 * Social seam (PRODUCT_BLUEPRINT §2.C): the follow graph and the activity
 * feed. Screens talk to `useSocial()` (store.tsx); persistence sits behind
 * `SocialBackend` — Supabase when configured (0004_social.sql), an
 * AsyncStorage fallback otherwise so local accounts on one device can still
 * follow each other and share a feed.
 */

import type { ItemType } from '@/ranking/types';

/** A user visible in the people directory. */
export interface Profile {
  userId: string;
  displayName: string;
  /** Ordered Top 4 item ids (PRODUCT_BLUEPRINT §2.D). Empty until chosen. */
  favorites?: string[];
}

export type SocialEventType = 'rated' | 'drop' | 'streak';

/**
 * Type-specific event details. One loose bag (mirrors the jsonb column) so new
 * event types don't ripple through every backend.
 */
export interface SocialEventPayload {
  itemId?: string;
  itemType?: ItemType;
  title?: string;
  artist?: string;
  artUrl?: string;
  /** 'rated' events. */
  score?: number;
  /** 'drop' events. */
  caption?: string;
  /** 'streak' events. */
  days?: number;
}

/** One activity-feed entry, as stored. */
export interface SocialEvent {
  id: string;
  userId: string;
  displayName: string;
  type: SocialEventType;
  payload: SocialEventPayload;
  /** ISO timestamp. */
  createdAt: string;
}

/** What `publish` receives — the backend stamps id + createdAt. */
export type NewSocialEvent = Omit<SocialEvent, 'id' | 'createdAt'>;

/** Thrown for expected persistence failures — UI-safe message. */
export class SocialError extends Error {}

export interface SocialBackend {
  /** Make/refresh the user's directory entry (called at sign-in). */
  upsertProfile(profile: Profile): Promise<void>;
  /** Everyone in the directory (including the caller — the store filters). */
  listProfiles(): Promise<Profile[]>;
  /** Ids the user follows. */
  following(userId: string): Promise<string[]>;
  setFollowing(followerId: string, followeeId: string, follow: boolean): Promise<void>;
  /** Replace the user's Top 4 (ordered item ids, at most 4). */
  setFavorites(userId: string, itemIds: string[]): Promise<void>;
  /** Append one event to the activity log. Returns it with id + timestamp. */
  publishEvent(event: NewSocialEvent): Promise<SocialEvent>;
  /** Recent events by these users (self + followees), newest first. */
  feedFor(userIds: string[], limit?: number): Promise<SocialEvent[]>;
}
