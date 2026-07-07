import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  DeezerArtistImages,
  artistSearchUrl,
  parseArtistImage,
  pickArtistPicture,
  type DeezerSearchResponse,
} from './deezer';

const withHash = (size: string) =>
  `https://cdn-images.dzcdn.net/images/artist/abc123/${size}-000000-80-0-0.jpg`;
const placeholder = (size: string) =>
  `https://cdn-images.dzcdn.net/images/artist//${size}-000000-80-0-0.jpg`; // empty hash → no photo

test('artistSearchUrl encodes the name and limits to one hit', () => {
  assert.equal(
    artistSearchUrl('Tame Impala'),
    'https://api.deezer.com/search/artist?q=Tame%20Impala&limit=1',
  );
});

test('pickArtistPicture prefers the largest and skips placeholder silhouettes', () => {
  assert.equal(
    pickArtistPicture({ picture_medium: withHash('250x250'), picture_xl: withHash('1000x1000') }),
    withHash('1000x1000'),
  );
  // xl is a placeholder (empty hash) → fall through to a real medium.
  assert.equal(
    pickArtistPicture({ picture_xl: placeholder('1000x1000'), picture_medium: withHash('250x250') }),
    withHash('250x250'),
  );
  assert.equal(pickArtistPicture({ picture_xl: placeholder('1000x1000') }), undefined);
  assert.equal(pickArtistPicture(undefined), undefined);
});

test('parseArtistImage reads the first artist, or undefined when empty', () => {
  assert.equal(
    parseArtistImage({ data: [{ name: 'X', picture_big: withHash('500x500') }] }),
    withHash('500x500'),
  );
  assert.equal(parseArtistImage({ data: [] }), undefined);
  assert.equal(parseArtistImage({}), undefined);
});

test('getArtistImage resolves, caches (including misses), and skips blank names', async () => {
  let calls = 0;
  const request = async (): Promise<DeezerSearchResponse> => {
    calls += 1;
    return { data: [{ name: 'Tame Impala', picture_xl: withHash('1000x1000') }] };
  };
  const provider = new DeezerArtistImages(request);

  assert.equal(await provider.getArtistImage('Tame Impala'), withHash('1000x1000'));
  assert.equal(await provider.getArtistImage('tame impala'), withHash('1000x1000')); // cache hit (normalized)
  assert.equal(calls, 1);

  assert.equal(await provider.getArtistImage('   '), undefined);
  assert.equal(calls, 1); // blank never hits the network

  // A miss is cached too — the same name isn't looked up twice.
  const misses = new DeezerArtistImages(async () => ({ data: [] }));
  assert.equal(await misses.getArtistImage('Nobody'), undefined);
  assert.equal(await misses.getArtistImage('Nobody'), undefined);
});

test('getArtistImage swallows network errors but rethrows aborts', async () => {
  const netErr = new DeezerArtistImages(async () => {
    throw new Error('network down');
  });
  assert.equal(await netErr.getArtistImage('X'), undefined);

  const aborted = new DeezerArtistImages(async () => {
    const e = new Error('aborted');
    e.name = 'AbortError';
    throw e;
  });
  await assert.rejects(() => aborted.getArtistImage('X'), (e: Error) => e.name === 'AbortError');
});
