/**
 * Seed playlists so the Profile isn't empty before the user makes their own.
 * Covers reuse real Cover Art Archive art via the album MBIDs already used in
 * src/data/catalog. Mock, like the rest of the seed data.
 */

import { coverArtUrl } from '@/music';

import type { Playlist } from './types';

const cover = (mbid: string) => coverArtUrl(mbid, 500);

const BLONDE = '0da340a0-6ad7-4fc2-a272-6f94393a7831';
const CHANNEL_ORANGE = 'f8f4167d-897c-4b25-a171-638374d1dfa4';
const SOS = '1646286a-d0ad-4288-bfab-34b0fb7b22c1';
const IGOR = '0f1b9e07-b38b-4bba-9794-55e0924d7177';
const GKMC = '499c19c8-0dab-4824-884b-6191d145e95b';
const CURRENTS = '08aa7a6c-3e43-4459-87b2-e47faf3a088a';

export const SEED_PLAYLISTS: Playlist[] = [
  {
    id: 'pl-seed-latenight',
    name: 'Late night',
    createdAt: '2026-06-20T00:00:00Z',
    songs: [
      { id: 'seed-nights', title: 'Nights', artist: 'Frank Ocean', artUrl: cover(BLONDE), kind: 'song' },
      { id: 'seed-earfquake', title: 'EARFQUAKE', artist: 'Tyler, The Creator', artUrl: cover(IGOR), kind: 'song' },
      { id: 'seed-snooze', title: 'Snooze', artist: 'SZA', artUrl: cover(SOS), kind: 'song' },
      { id: 'seed-thinkin', title: 'Thinkin Bout You', artist: 'Frank Ocean', artUrl: cover(CHANNEL_ORANGE), kind: 'song' },
    ],
  },
  {
    id: 'pl-seed-focus',
    name: 'Focus',
    createdAt: '2026-06-25T00:00:00Z',
    songs: [
      { id: 'seed-letit', title: 'Let It Happen', artist: 'Tame Impala', artUrl: cover(CURRENTS), kind: 'song' },
      { id: 'seed-money', title: 'Money Trees', artist: 'Kendrick Lamar', artUrl: cover(GKMC), kind: 'song' },
    ],
  },
];
