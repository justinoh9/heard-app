/** Unit tests for the pure browse aggregation (offline). */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  aggregateBrowseItems,
  browseGenres,
  forGenre,
  topRated,
  trending,
  TRENDING_WINDOW_MS,
} from './aggregate';
import type { RatingWithItem } from './types';

const NOW = Date.parse('2026-07-13T00:00:00.000Z');
const daysAgo = (n: number) => new Date(NOW - n * 24 * 60 * 60 * 1000).toISOString();

function rating(
  itemId: string,
  score: number,
  createdAt: string,
  over: Partial<RatingWithItem['item']> = {},
): RatingWithItem {
  return {
    score,
    createdAt,
    item: {
      id: itemId,
      type: 'album',
      title: `Title ${itemId}`,
      artist: `Artist ${itemId}`,
      genres: ['Hip-Hop/Rap'],
      ...over,
    },
  };
}

describe('aggregateBrowseItems', () => {
  it('groups ratings per item and averages scores', () => {
    const items = aggregateBrowseItems(
      [rating('a', 8, daysAgo(1)), rating('a', 10, daysAgo(2)), rating('b', 6, daysAgo(1))],
      NOW,
    );
    const a = items.find((i) => i.id === 'a')!;
    assert.equal(a.ratingCount, 2);
    assert.equal(a.avgScore, 9);
    assert.equal(items.find((i) => i.id === 'b')!.avgScore, 6);
  });

  it('counts only ratings inside the trending window as recent', () => {
    const insideEdge = new Date(NOW - TRENDING_WINDOW_MS + 1000).toISOString();
    const outside = new Date(NOW - TRENDING_WINDOW_MS - 1000).toISOString();
    const [item] = aggregateBrowseItems(
      [rating('a', 8, insideEdge), rating('a', 8, outside)],
      NOW,
    );
    assert.equal(item.ratingCount, 2);
    assert.equal(item.recentCount, 1);
  });

  it('carries item metadata through from the first-seen row', () => {
    const [item] = aggregateBrowseItems(
      [rating('a', 8, daysAgo(1), { title: 'Blonde', releaseYear: 2016 })],
      NOW,
    );
    assert.equal(item.title, 'Blonde');
    assert.equal(item.releaseYear, 2016);
  });
});

describe('trending', () => {
  it('ranks by recent activity and drops items with none', () => {
    const items = aggregateBrowseItems(
      [
        rating('hot', 7, daysAgo(1)),
        rating('hot', 7, daysAgo(2)),
        rating('warm', 9, daysAgo(1)),
        rating('stale', 10, daysAgo(30)),
      ],
      NOW,
    );
    const result = trending(items);
    assert.deepEqual(result.map((i) => i.id), ['hot', 'warm']);
  });
});

describe('topRated', () => {
  it('ranks by average but requires a minimum rating count', () => {
    const items = aggregateBrowseItems(
      [
        rating('solo', 10, daysAgo(1)),
        rating('proven', 9, daysAgo(1)),
        rating('proven', 9, daysAgo(2)),
      ],
      NOW,
    );
    const result = topRated(items, 2);
    // 'solo' has a perfect 10 but only one rating — excluded by minCount.
    assert.deepEqual(result.map((i) => i.id), ['proven']);
  });
});

describe('forGenre', () => {
  it('filters case-insensitively and sorts by average', () => {
    const items = aggregateBrowseItems(
      [
        rating('rap1', 9, daysAgo(1), { genres: ['Hip-Hop/Rap'] }),
        rating('rap2', 7, daysAgo(1), { genres: ['hip-hop/rap'] }),
        rating('rock', 10, daysAgo(1), { genres: ['Rock'] }),
      ],
      NOW,
    );
    const result = forGenre(items, 'Hip-Hop/Rap');
    assert.deepEqual(result.map((i) => i.id), ['rap1', 'rap2']);
  });
});

describe('browseGenres', () => {
  it('ranks genres by item count and drops the generic Music bucket', () => {
    const items = aggregateBrowseItems(
      [
        rating('a', 8, daysAgo(1), { genres: ['Rock', 'Music'] }),
        rating('b', 8, daysAgo(1), { genres: ['Rock'] }),
        rating('c', 8, daysAgo(1), { genres: ['Jazz'] }),
      ],
      NOW,
    );
    const genres = browseGenres(items);
    assert.deepEqual(genres, ['Rock', 'Jazz']);
    assert.ok(!genres.includes('Music'));
  });
});
