/**
 * Badges / achievements (ROADMAP Phase 3): cheap retention derived entirely at
 * read time from counts the app already holds — no migration, no write hooks,
 * the same posture as notifications. A badge is earned the moment its metric
 * crosses the threshold; locked badges show progress toward it.
 *
 * React/Supabase-free (relative imports only) so it runs under the tsx node
 * test runner, like browse/aggregate.ts and taste/profile.ts.
 */

import type { RankedItem } from '../ranking/types';

/** The metrics badges are judged against. All simple monotonic counts. */
export interface BadgeInputs {
  ratingCount: number;
  /** Distinct genres among rated items (items without a genre don't count). */
  genreCount: number;
  /** Distinct release decades among rated items. */
  decadeCount: number;
  concertCount: number;
  /** Best streak ever, not the current one — badges never un-earn. */
  longestStreak: number;
  listCount: number;
  queueCount: number;
}

export interface Badge {
  id: string;
  title: string;
  /** How to earn it — shown on locked tiles; doubles as the earned caption. */
  blurb: string;
  /** Ionicons name (kept as a plain string so this module stays node-safe). */
  icon: string;
  earned: boolean;
  /** Progress toward the threshold, capped at `need` for display. */
  have: number;
  need: number;
}

interface BadgeDef {
  id: string;
  title: string;
  blurb: string;
  icon: string;
  metric: keyof BadgeInputs;
  need: number;
}

/**
 * The fixed badge ladder. Ordering is deliberate: families group together and
 * climb, so the screen reads as a progression rather than a grab bag.
 */
const DEFS: BadgeDef[] = [
  // Logging ladder — the core habit.
  { id: 'first-spin', title: 'First Spin', blurb: 'Rate your first song or album', icon: 'musical-note', metric: 'ratingCount', need: 1 },
  { id: 'ten-deep', title: 'Ten Deep', blurb: 'Rate 10 songs or albums', icon: 'albums', metric: 'ratingCount', need: 10 },
  { id: 'deep-cuts', title: 'Deep Cuts', blurb: 'Rate 50 songs or albums', icon: 'disc', metric: 'ratingCount', need: 50 },
  { id: 'century-club', title: 'Century Club', blurb: 'Rate 100 songs or albums', icon: 'trophy', metric: 'ratingCount', need: 100 },
  // Range — genres and eras.
  { id: 'genre-hopper', title: 'Genre Hopper', blurb: 'Rate music from 3 different genres', icon: 'shuffle', metric: 'genreCount', need: 3 },
  { id: 'omnivore', title: 'Omnivore', blurb: 'Rate music from 6 different genres', icon: 'color-palette', metric: 'genreCount', need: 6 },
  { id: 'time-traveler', title: 'Time Traveler', blurb: 'Rate music from 3 different decades', icon: 'hourglass', metric: 'decadeCount', need: 3 },
  { id: 'crate-digger', title: 'Crate Digger', blurb: 'Rate music from 5 different decades', icon: 'file-tray-full', metric: 'decadeCount', need: 5 },
  // Live music — the concert wedge.
  { id: 'first-show', title: 'First Show', blurb: 'Log your first concert', icon: 'mic', metric: 'concertCount', need: 1 },
  { id: 'show-regular', title: 'Show Regular', blurb: 'Log 5 concerts', icon: 'ticket', metric: 'concertCount', need: 5 },
  { id: 'front-row', title: 'Front Row Fixture', blurb: 'Log 15 concerts', icon: 'flame', metric: 'concertCount', need: 15 },
  // Streaks — best-ever, so a lapse never revokes them.
  { id: 'warming-up', title: 'Warming Up', blurb: 'Keep a 3-day logging streak', icon: 'bonfire', metric: 'longestStreak', need: 3 },
  { id: 'week-streak', title: 'Full Week', blurb: 'Keep a 7-day logging streak', icon: 'calendar', metric: 'longestStreak', need: 7 },
  { id: 'month-streak', title: 'True Devotion', blurb: 'Keep a 30-day logging streak', icon: 'medal', metric: 'longestStreak', need: 30 },
  // Collections.
  { id: 'list-maker', title: 'List Maker', blurb: 'Create your first list', icon: 'list', metric: 'listCount', need: 1 },
  { id: 'wishful-listener', title: 'Wishful Listener', blurb: 'Queue 5 things you want to listen to', icon: 'bookmark', metric: 'queueCount', need: 5 },
];

/** Judge every badge against the inputs, in ladder order. */
export function computeBadges(inputs: BadgeInputs): Badge[] {
  return DEFS.map((def) => {
    const value = inputs[def.metric];
    return {
      id: def.id,
      title: def.title,
      blurb: def.blurb,
      icon: def.icon,
      earned: value >= def.need,
      have: Math.min(value, def.need),
      need: def.need,
    };
  });
}

/** Count of earned badges — the Profile card headline. */
export function earnedCount(badges: Badge[]): number {
  return badges.filter((b) => b.earned).length;
}

/**
 * Fold the viewer's ranked list into the genre/decade metrics. Genre is the
 * single iTunes label on each item; decades come from the item's release year.
 */
export function badgeInputsFromRanked(
  ranked: RankedItem[],
  rest: Omit<BadgeInputs, 'ratingCount' | 'genreCount' | 'decadeCount'>,
): BadgeInputs {
  const genres = new Set<string>();
  const decades = new Set<number>();
  for (const r of ranked) {
    const g = r.item.genre?.trim().toLowerCase();
    if (g && g !== 'music') genres.add(g);
    const year = Number(r.item.year);
    if (Number.isFinite(year) && year > 0) decades.add(Math.floor(year / 10) * 10);
  }
  return {
    ratingCount: ranked.length,
    genreCount: genres.size,
    decadeCount: decades.size,
    ...rest,
  };
}
