/**
 * Ratings persistence seam (PRODUCT_BLUEPRINT §3.3): `useRatings()` keeps its
 * screen-facing API, but the list + banked comparison log now live behind this
 * interface. `SupabaseRatingsBackend` (supabase-ratings-backend.ts) is the real
 * one; `LocalRatingsBackend` here is the zero-config fallback so a checkout
 * without a Supabase project still persists ratings across reloads
 * (AsyncStorage, like src/auth/ and src/streaks/).
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

import type { ComparisonEvent, RankedItem } from '@/ranking/types';

export interface RatingsSnapshot {
  list: RankedItem[];
  events: ComparisonEvent[];
}

/** Thrown for expected persistence failures (network, policy) — UI-safe message. */
export class RatingsBackendError extends Error {}

export interface RatingsBackend {
  /**
   * The user's stored ratings + comparison log, or null when nothing has ever
   * been stored (a brand-new user — the caller seeds the demo list).
   */
  load(userId: string): Promise<RatingsSnapshot | null>;
  /**
   * Persist a finished placement: the full new list (small at prototype scale,
   * and the tie-break renumbering touches a whole score group anyway) plus the
   * comparison events to append.
   */
  commit(userId: string, list: RankedItem[], events: ComparisonEvent[]): Promise<void>;
}

function storageKey(userId: string): string {
  return `heard.ratings.${userId}`;
}

export class LocalRatingsBackend implements RatingsBackend {
  async load(userId: string): Promise<RatingsSnapshot | null> {
    const raw = await AsyncStorage.getItem(storageKey(userId));
    return raw ? (JSON.parse(raw) as RatingsSnapshot) : null;
  }

  async commit(userId: string, list: RankedItem[], events: ComparisonEvent[]): Promise<void> {
    // Read-modify-write is safe here: one device, one user, serialized commits.
    const prev = await this.load(userId);
    const snapshot: RatingsSnapshot = {
      list,
      events: [...(prev?.events ?? []), ...events],
    };
    await AsyncStorage.setItem(storageKey(userId), JSON.stringify(snapshot));
  }
}
