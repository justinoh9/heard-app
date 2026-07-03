/**
 * Pure row ↔ model mapping for concerts (0006_concerts.sql), plus the
 * newest-first sort both backends share. Offline-testable, same split as
 * src/data/ratings-rows.ts.
 */

import type { Concert } from './types';

/** public.concerts select shape, with tags joined/aggregated by the caller. */
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
}

export function fromConcertRow(row: ConcertRow, taggedUserIds: string[]): Concert {
  return {
    id: row.id,
    userId: row.user_id,
    artistName: row.artist_name,
    artistId: row.artist_id ?? undefined,
    venue: row.venue ?? undefined,
    city: row.city ?? undefined,
    showDate: row.show_date,
    score: row.score ?? undefined,
    notes: row.notes ?? undefined,
    taggedUserIds,
    createdAt: row.created_at,
  };
}

export function toConcertRow(c: Omit<Concert, 'id' | 'createdAt'>): Omit<ConcertRow, 'id' | 'created_at'> {
  return {
    user_id: c.userId,
    artist_name: c.artistName,
    artist_id: c.artistId ?? null,
    venue: c.venue ?? null,
    city: c.city ?? null,
    show_date: c.showDate,
    score: c.score ?? null,
    notes: c.notes ?? null,
  };
}

/** Newest show first; ties broken by log time so ordering is stable. */
export function sortConcerts(concerts: Concert[]): Concert[] {
  return [...concerts].sort(
    (a, b) => b.showDate.localeCompare(a.showDate) || b.createdAt.localeCompare(a.createdAt),
  );
}

/** "Attended" filter: shows a user logged or was tagged at. */
export function concertsFor(userId: string, all: Concert[]): Concert[] {
  return sortConcerts(
    all.filter((c) => c.userId === userId || c.taggedUserIds.includes(userId)),
  );
}
