/**
 * Concert seam (PRODUCT_BLUEPRINT §2.C — the "map" mechanic): logged live
 * shows with venue, date, a performance score, and tagged friends. Screens
 * talk to `useConcerts()` (store.tsx); persistence sits behind
 * `ConcertsBackend` (Supabase 0006_concerts.sql, or the on-device world).
 */

export interface Concert {
  id: string;
  /** The logger. */
  userId: string;
  artistName: string;
  /** Optional Spotify artist id, when the artist came from search. */
  artistId?: string;
  venue?: string;
  city?: string;
  /** 'YYYY-MM-DD'. */
  showDate: string;
  /** Performance rating, 0–10 (same scale as music). */
  score?: number;
  notes?: string;
  /** Friends who were there (tags apply immediately — no confirm flow yet). */
  taggedUserIds: string[];
  /** ISO timestamp. */
  createdAt: string;
}

export type NewConcert = Omit<Concert, 'id' | 'createdAt'>;

/** Thrown for expected persistence failures — UI-safe message. */
export class ConcertsError extends Error {}

export interface ConcertsBackend {
  /** Shows the user logged plus shows they were tagged at, newest first. */
  listFor(userId: string): Promise<Concert[]>;
  add(concert: NewConcert): Promise<Concert>;
}
