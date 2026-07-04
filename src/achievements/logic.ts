/**
 * Achievements (PRODUCT_BLUEPRINT §2.D): tiered badges derived purely from the
 * data the user already accrues — the ranked list, the concert log, and the
 * streak record. No new storage: this is a deterministic rollup, like
 * src/data/stats.ts, so the /achievements screen just renders it.
 *
 * Concert milestones lean into "collecting shows" as a stated differentiator.
 */

import type { Concert } from '@/concerts/types';
import type { RankedItem } from '@/ranking/types';

export type BadgeCategory = 'ratings' | 'shows' | 'streak' | 'decades' | 'artists';

export interface Badge {
  id: string;
  category: BadgeCategory;
  title: string;
  /** What unlocks it — shown under the title. */
  description: string;
  /** Ionicons name. */
  icon: string;
  /** The metric value that unlocks this tier. */
  threshold: number;
  earned: boolean;
  /** Current metric toward the threshold, capped at it (for a progress bar). */
  progress: number;
}

export interface AchievementsSummary {
  badges: Badge[];
  earnedCount: number;
  total: number;
  /** The locked badge closest to unlocking (by ratio), or null if all earned. */
  nextUp: Badge | null;
}

interface BadgeDef {
  id: string;
  category: BadgeCategory;
  title: string;
  description: string;
  icon: string;
  threshold: number;
}

/**
 * Tiers per category, low → high. Copy is intentionally playful; icons come
 * from Ionicons so the screen can render them directly.
 */
const DEFS: BadgeDef[] = [
  // Ratings logged.
  { id: 'rate-1', category: 'ratings', title: 'First Take', description: 'Rate your first record', icon: 'star', threshold: 1 },
  { id: 'rate-10', category: 'ratings', title: 'Curator', description: 'Rate 10 records', icon: 'star', threshold: 10 },
  { id: 'rate-50', category: 'ratings', title: 'Critic', description: 'Rate 50 records', icon: 'star', threshold: 50 },
  { id: 'rate-100', category: 'ratings', title: 'Centurion', description: 'Rate 100 records', icon: 'star', threshold: 100 },
  // Live shows logged (the "map" / collecting mechanic).
  { id: 'show-1', category: 'shows', title: 'First Show', description: 'Log a live show', icon: 'mic', threshold: 1 },
  { id: 'show-5', category: 'shows', title: 'Regular', description: 'Log 5 shows', icon: 'mic', threshold: 5 },
  { id: 'show-10', category: 'shows', title: 'Road Warrior', description: 'Log 10 shows', icon: 'mic', threshold: 10 },
  { id: 'show-25', category: 'shows', title: 'Superfan', description: 'Log 25 shows', icon: 'mic', threshold: 25 },
  // Streak tiers (best run ever).
  { id: 'streak-3', category: 'streak', title: 'On a Roll', description: 'A 3-day logging streak', icon: 'flame', threshold: 3 },
  { id: 'streak-7', category: 'streak', title: 'Full Week', description: 'A 7-day logging streak', icon: 'flame', threshold: 7 },
  { id: 'streak-30', category: 'streak', title: 'Devoted', description: 'A 30-day logging streak', icon: 'flame', threshold: 30 },
  { id: 'streak-100', category: 'streak', title: 'Unbroken', description: 'A 100-day logging streak', icon: 'flame', threshold: 100 },
  // Distinct decades explored.
  { id: 'decade-3', category: 'decades', title: 'Time Traveler', description: 'Rate music from 3 decades', icon: 'time', threshold: 3 },
  { id: 'decade-5', category: 'decades', title: 'Era Spanner', description: 'Rate music from 5 decades', icon: 'time', threshold: 5 },
  // Distinct artists explored.
  { id: 'artist-10', category: 'artists', title: 'Explorer', description: 'Rate 10 different artists', icon: 'compass', threshold: 10 },
  { id: 'artist-25', category: 'artists', title: 'Digger', description: 'Rate 25 different artists', icon: 'compass', threshold: 25 },
  { id: 'artist-50', category: 'artists', title: 'Connoisseur', description: 'Rate 50 different artists', icon: 'compass', threshold: 50 },
];

/** Distinct credited artists (a "A, B" credit counts each name once, globally). */
function distinctArtists(ranked: RankedItem[]): number {
  const set = new Set<string>();
  for (const r of ranked) {
    for (const name of r.item.artist.split(',').map((a) => a.trim()).filter(Boolean)) {
      set.add(name.toLowerCase());
    }
  }
  return set.size;
}

/** Distinct decades among rated items with a parseable year. */
function distinctDecades(ranked: RankedItem[]): number {
  const set = new Set<number>();
  for (const r of ranked) {
    const year = r.item.year ? Number.parseInt(r.item.year, 10) : NaN;
    if (Number.isFinite(year)) set.add(Math.floor(year / 10) * 10);
  }
  return set.size;
}

export interface AchievementInput {
  ranked: RankedItem[];
  concerts: Concert[];
  /** Best-ever streak length (badges are permanent once earned). */
  longestStreak: number;
}

export function computeAchievements(input: AchievementInput): AchievementsSummary {
  const metrics: Record<BadgeCategory, number> = {
    ratings: input.ranked.length,
    shows: input.concerts.length,
    streak: input.longestStreak,
    decades: distinctDecades(input.ranked),
    artists: distinctArtists(input.ranked),
  };

  const badges: Badge[] = DEFS.map((d) => {
    const metric = metrics[d.category];
    return {
      ...d,
      earned: metric >= d.threshold,
      progress: Math.min(metric, d.threshold),
    };
  });

  const earnedCount = badges.filter((b) => b.earned).length;

  // Closest locked badge: highest completion ratio, ties broken by fewest
  // remaining so "1 away" always wins, then by id for stability.
  const nextUp =
    badges
      .filter((b) => !b.earned)
      .sort(
        (a, b) =>
          b.progress / b.threshold - a.progress / a.threshold ||
          a.threshold - a.progress - (b.threshold - b.progress) ||
          a.id.localeCompare(b.id),
      )[0] ?? null;

  return { badges, earnedCount, total: badges.length, nextUp };
}
