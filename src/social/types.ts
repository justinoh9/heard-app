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
  /** Unique @handle (case-insensitive), a short bio, and an avatar — the
   *  profile-identity fields (ROADMAP G4). All optional. */
  handle?: string;
  bio?: string;
  avatarUrl?: string;
}

/** The user-editable identity fields (handle/bio/avatar), all optional. */
export interface ProfilePatch {
  handle?: string | null;
  bio?: string | null;
  avatarUrl?: string | null;
}

/** Thrown when a chosen @handle is already taken (unique-index violation). */
export class HandleTakenError extends Error {}

export type SocialEventType = 'rated' | 'drop' | 'streak' | 'concert' | 'made_list' | 'repost';

/**
 * Type-specific event details. One loose bag (mirrors the jsonb column) so new
 * event types don't ripple through every backend.
 */
export interface SocialEventPayload {
  itemId?: string;
  itemType?: ItemType;
  /** Item title — or the artist name for 'concert' events. */
  title?: string;
  /** Credited artist — or the "venue · city" line for 'concert' events. */
  artist?: string;
  artUrl?: string;
  /** 'rated' and 'concert' events. */
  score?: number;
  /** 'drop' events. */
  caption?: string;
  /** 'rated' events — the optional review text, so it rides the feed card. */
  review?: string;
  /** 'streak' events. */
  days?: number;
  /** 'repost' events — the reposter's optional comment. */
  note?: string;
  /** 'repost' events — what was reshared, for attribution + rendering. */
  originalType?: SocialEventType;
  originalUserId?: string;
  originalDisplayName?: string;
}
// 'made_list' events reuse `title` for the list name (no item link).
// 'repost' events reuse title/artist/artUrl/score/review/itemId for the
// original content, and carry the fields above for attribution + the note.

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

/**
 * One user's aggregate counts for the Ranks leaderboard. All three metrics are
 * computable from real cloud data: ratings logged, concerts logged, comments
 * posted. (The old device-local streak metric was dropped — it lives only in
 * AsyncStorage, so it can't be aggregated across users.) The pure ranking +
 * scope + current-user-injection logic lives in src/leaderboard/rank.ts.
 */
export interface LeaderboardEntry {
  userId: string;
  displayName: string;
  /** Number of items this user has rated. */
  rated: number;
  /** Number of concerts this user has logged. */
  shows: number;
  /** Number of comments this user has posted. */
  reviews: number;
}

/** One user's score for a single item — the raw input to the item-page breakdown. */
export interface ItemRating {
  userId: string;
  score: number;
}

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
  /** Update the identity fields (handle/bio/avatar). Throws HandleTakenError
   *  when the requested handle collides with another user's. */
  updateProfile(userId: string, patch: ProfilePatch): Promise<void>;
  /** Append one event to the activity log. Returns it with id + timestamp. */
  publishEvent(event: NewSocialEvent): Promise<SocialEvent>;
  /**
   * Recent events by these users (self + followees), newest first. Pass
   * `before` (an ISO timestamp — the oldest event you already hold) to page
   * backwards; omit it for the first page.
   */
  feedFor(userIds: string[], limit?: number, before?: string): Promise<SocialEvent[]>;
  /** Per-user aggregate counts across every profile (Ranks leaderboard). */
  leaderboard(): Promise<LeaderboardEntry[]>;
  /** Every user's rating of one item (item-page score breakdown). */
  ratingsForItem(itemId: string): Promise<ItemRating[]>;
}
