/**
 * Concert seam (PRODUCT_BLUEPRINT §2.C — the "map" mechanic): logged live
 * shows with venue, date, a performance score, and tagged friends. Screens
 * talk to `useConcerts()` (store.tsx); persistence sits behind
 * `ConcertsBackend` (Supabase 0006_concerts.sql, or the on-device world).
 */

/** A show already seen ('attended') vs one you want to go to ('wishlist'). */
export type ConcertStatus = 'attended' | 'wishlist';

/** A tagged attendee waits at 'pending' until they confirm they were there. */
export type TagStatus = 'pending' | 'confirmed';

export interface ConcertTag {
  userId: string;
  status: TagStatus;
}

export interface Concert {
  id: string;
  /** The logger. */
  userId: string;
  artistName: string;
  /** Optional Spotify artist id, when the artist came from search. */
  artistId?: string;
  venue?: string;
  city?: string;
  /** Venue latitude (0018), when the venue was picked from autocomplete. */
  lat?: number;
  /** Venue longitude (0018). Absent for hand-typed venues — those skip the map. */
  lng?: number;
  /** 'YYYY-MM-DD'. */
  showDate: string;
  /** Performance rating, 0–10 (same scale as music). Absent on a wishlist show. */
  score?: number;
  notes?: string;
  /** Attended vs a want-to-go wishlist entry. */
  status: ConcertStatus;
  /** Tagged attendees with their confirm state. */
  tags: ConcertTag[];
  /** ISO timestamp. */
  createdAt: string;
}

export interface NewConcert {
  userId: string;
  artistName: string;
  artistId?: string;
  venue?: string;
  city?: string;
  lat?: number;
  lng?: number;
  showDate: string;
  score?: number;
  notes?: string;
  status: ConcertStatus;
  /** User ids to tag; each starts 'pending' until the tagged user confirms. */
  taggedUserIds: string[];
}

/** Thrown for expected persistence failures — UI-safe message. */
export class ConcertsError extends Error {}

export interface ConcertsBackend {
  /** Shows the user logged plus shows they were tagged at, newest first. */
  listFor(userId: string): Promise<Concert[]>;
  add(concert: NewConcert): Promise<Concert>;
  /** Mark the caller's own show attended (from a wishlist entry). */
  markAttended(concertId: string): Promise<void>;
  /** Delete one of the caller's own shows. */
  remove(concertId: string): Promise<void>;
  /** Confirm the caller's own pending tag at a show. */
  confirmTag(concertId: string, userId: string): Promise<void>;
  /** Decline (remove) the caller's own tag at a show. */
  declineTag(concertId: string, userId: string): Promise<void>;
}
