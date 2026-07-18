import assert from 'node:assert/strict';
import { test } from 'node:test';

import { parseAppleRss, recentReleases, type NewRelease } from './apple-rss';

const FEED = {
  feed: {
    results: [
      {
        id: '111',
        name: 'Fresh Album',
        artistName: 'A',
        releaseDate: '2026-07-10',
        kind: 'albums',
        artworkUrl100: 'https://x/100x100bb.jpg',
        genres: [
          { name: 'Music' },
          { name: 'Hip-Hop/Rap' },
        ],
      },
      { id: '222', name: 'No Date', artistName: 'B' }, // dropped: no releaseDate
      {
        id: '333',
        name: 'Old Album',
        artistName: 'C',
        releaseDate: '2020-01-01',
        kind: 'albums',
      },
    ],
  },
};

test('parseAppleRss maps entries, upscales art, and skips the generic Music genre', () => {
  const releases = parseAppleRss(FEED);
  assert.equal(releases.length, 2);
  assert.deepEqual(releases[0], {
    id: '111',
    title: 'Fresh Album',
    artist: 'A',
    artUrl: 'https://x/600x600bb.jpg',
    releaseDate: '2026-07-10',
    genre: 'Hip-Hop/Rap',
  });
  assert.equal(releases[1].genre, undefined);
});

test('parseAppleRss survives an empty or malformed feed', () => {
  assert.deepEqual(parseAppleRss({}), []);
  assert.deepEqual(parseAppleRss({ feed: {} }), []);
});

const release = (id: string, releaseDate: string): NewRelease => ({
  id,
  title: id,
  artist: 'x',
  releaseDate,
});

test('recentReleases keeps the window, newest first, and caps the list', () => {
  const now = new Date('2026-07-18');
  const out = recentReleases(
    [release('old', '2026-01-01'), release('a', '2026-06-01'), release('b', '2026-07-10')],
    now,
  );
  assert.deepEqual(out.map((r) => r.id), ['b', 'a']);

  const capped = recentReleases(
    [1, 2, 3].map((n) => release(`r${n}`, `2026-07-0${n}`)),
    now,
    90,
    2,
  );
  assert.deepEqual(capped.map((r) => r.id), ['r3', 'r2']);
});

test('recentReleases keeps future-dated pre-adds and drops unparseable dates', () => {
  const now = new Date('2026-07-18');
  const out = recentReleases([release('pre', '2026-08-01'), release('bad', 'someday')], now);
  assert.deepEqual(out.map((r) => r.id), ['pre']);
});
