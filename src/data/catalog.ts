/**
 * Mock data for the MVP. The album catalog now comes from MusicBrainz search
 * (src/music) — this file just seeds the user's starting ranked list, the feed,
 * and profile chrome so the app isn't empty. Supabase replaces it later.
 */

import { coverArtUrl } from '@/music';
import type { Item, ItemType, RankedItem } from '@/ranking/types';

/** Build an album Item from a real MusicBrainz release-group id (with cover). */
const album = (mbid: string, title: string, artist: string): Item => ({
  id: mbid,
  type: 'album',
  title,
  artist,
  artUrl: coverArtUrl(mbid, 500),
});

const BLONDE = album('0da340a0-6ad7-4fc2-a272-6f94393a7831', 'Blonde', 'Frank Ocean');
const CHANNEL_ORANGE = album('f8f4167d-897c-4b25-a171-638374d1dfa4', 'channel ORANGE', 'Frank Ocean');
const SOS = album('1646286a-d0ad-4288-bfab-34b0fb7b22c1', 'SOS', 'SZA');
const IGOR = album('0f1b9e07-b38b-4bba-9794-55e0924d7177', 'IGOR', 'Tyler, The Creator');
const GKMC = album('499c19c8-0dab-4824-884b-6191d145e95b', 'good kid, m.A.A.d city', 'Kendrick Lamar');
const CURRENTS = album('08aa7a6c-3e43-4459-87b2-e47faf3a088a', 'Currents', 'Tame Impala');

/** The user's starting ranked list. Note the tie at 8.5 to show the tie-break. */
export const INITIAL_RANKED: RankedItem[] = [
  { item: BLONDE, score: 9.6, tiebreak: 0 },
  { item: CHANNEL_ORANGE, score: 9.1, tiebreak: 0 },
  { item: IGOR, score: 8.5, tiebreak: 1 },
  { item: GKMC, score: 8.5, tiebreak: 0 },
  { item: CURRENTS, score: 7.9, tiebreak: 0 },
];

export interface FeedEvent {
  id: string;
  user: string;
  initials: string;
  kind: 'rated' | 'drop' | 'streak' | 'concert';
  coverUrl?: string;
  /** Album title, track line, or streak text depending on kind. */
  title: string;
  artist?: string;
  score?: number;
  review?: string;
  likes: number;
  comments: number;
  /** Set for 'rated'/'drop' events — links the card to /item/[id]. */
  itemId?: string;
  itemType?: ItemType;
  /** ISO timestamp — set on real events (src/social), absent on mock rows. */
  createdAt?: string;
  /** The actor's user id — set on real events; links the avatar to /user/[id]. */
  userId?: string;
}

export const FEED: FeedEvent[] = [
  {
    id: 'f0',
    user: 'bbq',
    initials: 'B',
    kind: 'drop',
    coverUrl: CURRENTS.artUrl,
    title: 'The Less I Know the Better',
    artist: 'Tame Impala',
    likes: 4,
    comments: 0,
    itemId: CURRENTS.id,
    itemType: CURRENTS.type,
  },
  {
    id: 'f1',
    user: 'maya',
    initials: 'M',
    kind: 'rated',
    coverUrl: SOS.artUrl,
    title: 'SOS',
    artist: 'SZA',
    score: 8.8,
    review: 'party album of the year, no notes',
    likes: 12,
    comments: 3,
    itemId: SOS.id,
    itemType: SOS.type,
  },
  {
    id: 'f2',
    user: 'devon',
    initials: 'D',
    kind: 'rated',
    coverUrl: IGOR.artUrl,
    title: 'IGOR',
    artist: 'Tyler, The Creator',
    score: 9.2,
    review: 'grew on me so much',
    likes: 7,
    comments: 2,
    itemId: IGOR.id,
    itemType: IGOR.type,
  },
  {
    id: 'f3',
    user: 'devon',
    initials: 'D',
    kind: 'streak',
    title: 'hit a 30-day streak',
    likes: 8,
    comments: 1,
  },
];

export const PROFILE = {
  username: 'justin',
  initials: 'JK',
  tags: 'indie · hip-hop',
  shows: 14,
  streak: 23,
  badges: [
    { id: 'b0', artist: 'Tyler', year: '24' },
    { id: 'b1', artist: 'SZA', year: '23' },
    { id: 'b2', artist: 'Clairo', year: '24' },
  ],
};
