import assert from 'node:assert/strict';
import { test } from 'node:test';

import { coverArtUrl, MusicBrainzCatalog, parseAlbumResults } from './musicbrainz';
import { MusicCatalogError } from './types';

const fixture = {
  'release-groups': [
    {
      id: 'rg-single',
      title: 'Ditto',
      'primary-type': 'Single',
      'first-release-date': '2022-12-19',
      'artist-credit': [{ name: 'NewJeans', joinphrase: '' }],
    },
    {
      id: 'rg-album',
      title: 'Get Up',
      'primary-type': 'Album',
      'first-release-date': '2023-07-21',
      'artist-credit': [{ name: 'NewJeans' }],
    },
    {
      id: 'rg-collab',
      title: 'Collab',
      'primary-type': 'Album',
      'artist-credit': [{ name: 'A', joinphrase: ' & ' }, { name: 'B', joinphrase: '' }],
    },
  ],
};

const ok = (body: unknown) =>
  (async () => new Response(JSON.stringify(body), { status: 200 })) as unknown as typeof fetch;

test('parses title, artist, year, cover, type, provider', () => {
  const album = parseAlbumResults(fixture).find((x) => x.id === 'rg-album')!;
  assert.equal(album.title, 'Get Up');
  assert.equal(album.artist, 'NewJeans');
  assert.equal(album.year, '2023');
  assert.equal(album.coverUrl, coverArtUrl('rg-album'));
  assert.equal(album.primaryType, 'Album');
  assert.equal(album.provider, 'musicbrainz');
});

test('joins multi-artist credits using join phrases', () => {
  const collab = parseAlbumResults(fixture).find((x) => x.id === 'rg-collab')!;
  assert.equal(collab.artist, 'A & B');
});

test('missing first-release-date yields undefined year', () => {
  const collab = parseAlbumResults(fixture).find((x) => x.id === 'rg-collab')!;
  assert.equal(collab.year, undefined);
});

test('albums sort before singles/EPs', () => {
  const r = parseAlbumResults(fixture);
  assert.equal(r[0].primaryType, 'Album');
  assert.equal(r[r.length - 1].primaryType, 'Single');
});

test('empty / whitespace query returns [] without fetching', async () => {
  let called = false;
  const cat = new MusicBrainzCatalog((async () => {
    called = true;
    return new Response('{}');
  }) as unknown as typeof fetch);
  assert.deepEqual(await cat.searchAlbums('   '), []);
  assert.equal(called, false);
});

test('maps a successful HTTP response', async () => {
  const cat = new MusicBrainzCatalog(ok(fixture));
  const r = await cat.searchAlbums('newjeans');
  assert.equal(r.length, 3);
});

test('non-ok status throws a MusicCatalogError', async () => {
  const cat = new MusicBrainzCatalog(
    (async () => new Response('nope', { status: 503 })) as unknown as typeof fetch,
  );
  await assert.rejects(() => cat.searchAlbums('x'), MusicCatalogError);
});

test('network failure is wrapped as MusicCatalogError', async () => {
  const cat = new MusicBrainzCatalog((async () => {
    throw new TypeError('Failed to fetch');
  }) as unknown as typeof fetch);
  await assert.rejects(() => cat.searchAlbums('x'), MusicCatalogError);
});
