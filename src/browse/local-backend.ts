/**
 * Local (zero-config) browse. There is no cross-user cloud here, so it folds
 * together every ratings snapshot on the device (all `heard.ratings.*` keys) —
 * real local data, genuinely cross-account when a device has several demo
 * logins. Stored ratings carry no per-rating timestamp, so each is treated as
 * within the trending window (recent = total) — enough for a device-side demo.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

import type { RatingsSnapshot } from '@/data/ratings-backend';

import { aggregateBrowseItems } from './aggregate';
import type { BrowseBackend, BrowseItem, RatingWithItem } from './types';

const RATINGS_KEY_PREFIX = 'heard.ratings.';

export class LocalBrowseBackend implements BrowseBackend {
  /**
   * `options.genres` is ignored on purpose. It's a scoping hint that exists so the
   * Supabase backend can avoid shipping the whole table; a device holding a
   * handful of demo ratings has nothing to save by honouring it, and the callers
   * filter with `forAnyGenre` regardless. Returning a superset is allowed by the
   * seam — returning a *subset* would not be.
   */
  async load(): Promise<BrowseItem[]> {
    const keys = (await AsyncStorage.getAllKeys()).filter((k) => k.startsWith(RATINGS_KEY_PREFIX));
    if (keys.length === 0) return [];
    const entries = await AsyncStorage.multiGet(keys);
    const now = new Date().toISOString();
    const rows: RatingWithItem[] = [];
    for (const [, raw] of entries) {
      if (!raw) continue;
      let snapshot: RatingsSnapshot;
      try {
        snapshot = JSON.parse(raw) as RatingsSnapshot;
      } catch {
        continue;
      }
      for (const r of snapshot.list) {
        rows.push({
          score: r.score,
          createdAt: now,
          item: {
            id: r.item.id,
            type: r.item.type,
            title: r.item.title,
            artist: r.item.artist,
            artUrl: r.item.artUrl,
            releaseYear: r.item.year ? Number(r.item.year) : undefined,
            genres: r.item.genre ? [r.item.genre] : undefined,
          },
        });
      }
    }
    return aggregateBrowseItems(rows, Date.now());
  }
}
