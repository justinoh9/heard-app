/**
 * Pure helpers for the social seam: feed_events row ↔ model mapping and the
 * SocialEvent → feed-card display mapping. No client imports, so node tests
 * can cover them offline (same split as src/data/ratings-rows.ts).
 */

import type { FeedEvent } from '@/data/catalog';
import type { SocialEvent, SocialEventPayload, SocialEventType } from './types';

/** public.feed_events select/insert shape. */
export interface FeedEventRow {
  id: string;
  user_id: string;
  display_name: string;
  type: string;
  payload: SocialEventPayload;
  created_at: string;
}

export function fromFeedRow(row: FeedEventRow): SocialEvent {
  return {
    id: row.id,
    userId: row.user_id,
    displayName: row.display_name,
    type: row.type as SocialEventType,
    payload: row.payload ?? {},
    createdAt: row.created_at,
  };
}

export function toFeedRow(event: SocialEvent): FeedEventRow {
  return {
    id: event.id,
    user_id: event.userId,
    display_name: event.displayName,
    type: event.type,
    payload: event.payload,
    created_at: event.createdAt,
  };
}

export function initialsOf(displayName: string): string {
  const parts = displayName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  const first = parts[0][0] ?? '?';
  const last = parts.length > 1 ? (parts[parts.length - 1][0] ?? '') : '';
  return (first + last).toUpperCase();
}

/**
 * Map a stored SocialEvent onto the feed screen's existing card shape
 * (`FeedEvent` in src/data/catalog.ts), so real and mock rows render through
 * the same component. Likes/comments start at 0 — feed-event reactions are a
 * later slice.
 */
export function toDisplayEvent(e: SocialEvent): FeedEvent {
  const p = e.payload;
  const base = {
    id: e.id,
    user: e.displayName,
    initials: initialsOf(e.displayName),
    coverUrl: p.artUrl,
    artist: p.artist,
    likes: 0,
    comments: 0,
    itemId: p.itemId,
    itemType: p.itemType,
    createdAt: e.createdAt,
    userId: e.userId,
  };
  if (e.type === 'rated') {
    return { ...base, kind: 'rated', title: p.title ?? '', score: p.score };
  }
  if (e.type === 'drop') {
    return {
      ...base,
      kind: 'drop',
      title: p.title ?? '',
      review: p.caption,
    };
  }
  if (e.type === 'concert') {
    // title = artist name, artist = "venue · city" (see SocialEventPayload).
    return { ...base, kind: 'concert', title: p.title ?? '', score: p.score };
  }
  return {
    ...base,
    kind: 'streak',
    coverUrl: undefined,
    itemId: undefined,
    itemType: undefined,
    title: p.days ? `hit a ${p.days}-day streak` : 'extended their streak',
  };
}

/** Newest first, by createdAt. */
export function sortEvents(events: SocialEvent[]): SocialEvent[] {
  return [...events].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
