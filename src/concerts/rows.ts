/**
 * Pure row ↔ model mapping for concerts (0006 + 0017), plus the newest-first
 * sort and the per-viewer slices (attended / wishlist / invites) the screens
 * render. Offline-testable, same split as src/data/ratings-rows.ts.
 */

import type { Concert, ConcertStatus, ConcertTag, NewConcert, TagStatus } from './types';

/**
 * public.concerts select shape. `status` is absent pre-0017 → treated attended;
 * `lat`/`lng` are absent pre-0018 → the show simply has no map dot.
 */
export interface ConcertRow {
  id: string;
  user_id: string;
  artist_name: string;
  artist_id: string | null;
  venue: string | null;
  city: string | null;
  show_date: string;
  score: number | null;
  notes: string | null;
  created_at: string;
  status?: string | null;
  lat?: number | null;
  lng?: number | null;
}

/** public.concert_tags select shape. `status` absent pre-0017 → confirmed. */
export interface TagRow {
  concert_id: string;
  user_id: string;
  status?: string | null;
}

/** Map a tag row's status, defaulting to 'confirmed' when the column predates 0017. */
export function tagFromRow(row: TagRow): ConcertTag {
  return { userId: row.user_id, status: (row.status as TagStatus) ?? 'confirmed' };
}

export function fromConcertRow(row: ConcertRow, tags: ConcertTag[]): Concert {
  return {
    id: row.id,
    userId: row.user_id,
    artistName: row.artist_name,
    artistId: row.artist_id ?? undefined,
    venue: row.venue ?? undefined,
    city: row.city ?? undefined,
    lat: row.lat ?? undefined,
    lng: row.lng ?? undefined,
    showDate: row.show_date,
    score: row.score ?? undefined,
    notes: row.notes ?? undefined,
    status: (row.status as ConcertStatus) ?? 'attended',
    tags,
    createdAt: row.created_at,
  };
}

/**
 * Insert shape for a new show. Columns added by later migrations are only
 * included when they carry a value, so the insert still works against a project
 * that hasn't applied them yet: `status` only for a wishlist entry (the DB
 * default is 'attended'), and `lat`/`lng` only for a geocoded venue (0018).
 */
export function toConcertRow(c: NewConcert): Record<string, unknown> {
  const row: Record<string, unknown> = {
    user_id: c.userId,
    artist_name: c.artistName,
    artist_id: c.artistId ?? null,
    venue: c.venue ?? null,
    city: c.city ?? null,
    show_date: c.showDate,
    score: c.score ?? null,
    notes: c.notes ?? null,
  };
  if (c.status === 'wishlist') row.status = 'wishlist';
  // Both or neither — half a coordinate is worse than none.
  if (hasCoords(c)) {
    row.lat = c.lat;
    row.lng = c.lng;
  }
  return row;
}

/** True when the show carries a usable, in-range coordinate pair. */
export function hasCoords<T extends { lat?: number; lng?: number }>(
  c: T,
): c is T & { lat: number; lng: number } {
  return (
    typeof c.lat === 'number' &&
    typeof c.lng === 'number' &&
    Number.isFinite(c.lat) &&
    Number.isFinite(c.lng) &&
    Math.abs(c.lat) <= 90 &&
    Math.abs(c.lng) <= 180
  );
}

/** Newest show first; ties broken by log time so ordering is stable. */
export function sortConcerts(concerts: Concert[]): Concert[] {
  return [...concerts].sort(
    (a, b) => b.showDate.localeCompare(a.showDate) || b.createdAt.localeCompare(a.createdAt),
  );
}

/** True when `userId` is tagged at the show with the given confirm state. */
function taggedWith(c: Concert, userId: string, status: TagStatus): boolean {
  return c.tags.some((t) => t.userId === userId && t.status === status);
}

/**
 * Every show relevant to the user: ones they logged (any status) or were
 * tagged at (any tag state). The backends return this set; the slices below
 * split it for the screens.
 */
export function concertsFor(userId: string, all: Concert[]): Concert[] {
  return sortConcerts(
    all.filter((c) => c.userId === userId || c.tags.some((t) => t.userId === userId)),
  );
}

/**
 * The user's live-music map: attended shows they logged, plus attended shows
 * they've CONFIRMED they were tagged at. Pending tags stay out until confirmed.
 */
export function attendedFor(userId: string, all: Concert[]): Concert[] {
  return sortConcerts(
    all.filter(
      (c) =>
        c.status === 'attended' &&
        (c.userId === userId || taggedWith(c, userId, 'confirmed')),
    ),
  );
}

/** The user's own "want to go" wishlist. */
export function wishlistFor(userId: string, all: Concert[]): Concert[] {
  return sortConcerts(all.filter((c) => c.status === 'wishlist' && c.userId === userId));
}

/** Shows where the user has a pending tag to confirm or decline (not their own). */
export function invitesFor(userId: string, all: Concert[]): Concert[] {
  return sortConcerts(
    all.filter((c) => c.userId !== userId && taggedWith(c, userId, 'pending')),
  );
}

/** Confirmed attendee ids — who the show can honestly say was there. */
export function confirmedAttendees(c: Concert): string[] {
  return c.tags.filter((t) => t.status === 'confirmed').map((t) => t.userId);
}

export type { ConcertStatus, TagStatus };
