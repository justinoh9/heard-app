/**
 * Mock data for the MVP. This is the seam that Spotify + Supabase replace
 * later (SPEC §7–8): swap these constants for API calls and the screens above
 * don't change.
 */

import type { Item, RankedItem } from '@/ranking/types';

export interface FeedEvent {
  id: string;
  user: string;
  initials: string;
  kind: 'rated' | 'streak' | 'drop';
  title: string;
  subtitle?: string;
  score?: number;
  likes: number;
  comments: number;
}

export interface ConcertBadge {
  id: string;
  artist: string;
  year: string;
}

const song = (id: string, title: string, artist: string): Item => ({
  id,
  type: 'song',
  title,
  artist,
});

/** Songs the user can rate (the "haven't rated yet" pool). */
export const CATALOG: Item[] = [
  song('redbone', 'Redbone', 'Childish Gambino'),
  song('snooze', 'Snooze', 'SZA'),
  song('good-days', 'Good Days', 'SZA'),
  song('sunflower', 'Sunflower', 'Post Malone'),
  song('flashing-lights', 'Flashing Lights', 'Kanye West'),
  song('the-less-i-know', 'The Less I Know the Better', 'Tame Impala'),
  song('dang', 'DANG!', 'Mac Miller'),
  song('location', 'Location', 'Khalid'),
  song('bad-habit', 'Bad Habit', 'Steve Lacy'),
  song('pink-skies', 'Pink + White', 'Frank Ocean'),
];

/** The user's starting ranked list (so Profile/Feed have content). */
export const INITIAL_RANKED: RankedItem[] = [
  { item: song('nights', 'Nights', 'Frank Ocean'), score: 9.6, tiebreak: 0 },
  { item: song('self-control', 'Self Control', 'Frank Ocean'), score: 9.3, tiebreak: 0 },
  { item: song('ivy', 'Ivy', 'Frank Ocean'), score: 8.5, tiebreak: 1 },
  { item: song('sweet-life', 'Sweet Life', 'Frank Ocean'), score: 8.5, tiebreak: 0 },
  { item: song('best-part', 'Best Part', 'Daniel Caesar'), score: 7.8, tiebreak: 0 },
];

export const FEED: FeedEvent[] = [
  {
    id: 'f0',
    user: 'bbq',
    initials: 'B',
    kind: 'drop',
    title: 'is listening to',
    subtitle: 'DAYLIGHT — David Kushner',
    likes: 4,
    comments: 0,
  },
  {
    id: 'f1',
    user: 'maya',
    initials: 'M',
    kind: 'rated',
    title: 'rated Brat',
    subtitle: '“party album of the year, no notes”',
    score: 8.8,
    likes: 12,
    comments: 3,
  },
  {
    id: 'f2',
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
  ] as ConcertBadge[],
};
