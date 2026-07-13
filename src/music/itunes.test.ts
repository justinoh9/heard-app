import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  ITunesCatalog,
  albumToResult,
  deriveArtists,
  parseAlbumTracks,
  parseAlbums,
  parseArtistAlbums,
  parseTracks,
  trackToResult,
  upscaleArtwork,
  type ITunesEntity,
} from './itunes';
import { MusicCatalogError, type PopularityEnricher, type SearchResult } from './types';

// --- fixtures ---------------------------------------------------------------

const artwork = (id: string) => `https://is1.example.com/${id}/100x100bb.jpg`;

const albumEntity = (over: Partial<ITunesEntity> = {}): ITunesEntity => ({
  wrapperType: 'collection',
  collectionType: 'Album',
  collectionId: 1,
  collectionName: 'Currents',
  artistId: 10,
  artistName: 'Tame Impala',
  artworkUrl100: artwork('a1'),
  releaseDate: '2015-07-17T07:00:00Z',
  ...over,
});

const songEntity = (over: Partial<ITunesEntity> = {}): ITunesEntity => ({
  wrapperType: 'track',
  kind: 'song',
  trackId: 100,
  trackName: 'Let It Happen',
  collectionId: 1,
  collectionName: 'Currents',
  artistId: 10,
  artistName: 'Tame Impala',
  artworkUrl100: artwork('s1'),
  releaseDate: '2015-07-17T07:00:00Z',
  previewUrl: 'https://example.com/p.m4a',
  trackNumber: 1,
  trackTimeMillis: 467000,
  ...over,
});

/** A Response-ish stub. */
function jsonResponse(body: unknown, { ok = true, status = 200 } = {}): Response {
  return { ok, status, json: async () => body } as unknown as Response;
}

// --- pure helpers -----------------------------------------------------------

test('upscaleArtwork swaps the size segment, defaults to 600, leaves odd URLs alone', () => {
  assert.equal(upscaleArtwork(artwork('x')), 'https://is1.example.com/x/600x600bb.jpg');
  assert.equal(upscaleArtwork(artwork('x'), 1200), 'https://is1.example.com/x/1200x1200bb.jpg');
  assert.equal(upscaleArtwork('https://example.com/cover.jpg'), 'https://example.com/cover.jpg');
  assert.equal(upscaleArtwork(undefined), undefined);
});

test('albumToResult / trackToResult map fields and upscale art', () => {
  const album = albumToResult(albumEntity());
  assert.equal(album.kind, 'album');
  assert.equal(album.id, '1');
  assert.equal(album.title, 'Currents');
  assert.equal(album.artist, 'Tame Impala');
  assert.equal(album.year, '2015');
  assert.equal(album.coverUrl, 'https://is1.example.com/a1/600x600bb.jpg');
  assert.equal(album.provider, 'itunes');

  const song = trackToResult(songEntity());
  assert.equal(song.kind, 'song');
  assert.equal(song.id, '100');
  assert.equal(song.albumTitle, 'Currents');
  assert.equal(song.previewUrl, 'https://example.com/p.m4a');
});

test('parseAlbums dedupes by collection id and skips track wrappers', () => {
  const json = {
    results: [
      albumEntity({ collectionId: 1 }),
      albumEntity({ collectionId: 1 }), // dupe
      albumEntity({ collectionId: 2, collectionName: 'Lonerism' }),
      songEntity(), // not an album
    ],
  };
  const albums = parseAlbums(json);
  assert.deepEqual(
    albums.map((a) => a.id),
    ['1', '2'],
  );
});

test('parseTracks keeps songs, drops music videos, dedupes by track id', () => {
  const json = {
    results: [
      songEntity({ trackId: 100 }),
      songEntity({ trackId: 100 }), // dupe
      songEntity({ trackId: 101, kind: 'music-video', trackName: 'Video' }), // dropped
      albumEntity(), // not a track
    ],
  };
  assert.deepEqual(
    parseTracks(json).map((t) => t.id),
    ['100'],
  );
});

test('deriveArtists ranks the most-referenced artist first (relevance proxy)', () => {
  // A stray collaborator appears first but only once; the real artist recurs.
  const artists = deriveArtists([
    albumEntity({ artistId: 99, artistName: 'ZHU' }), // first, but a one-off
    songEntity({ artistId: 10, artistName: 'Tame Impala' }),
    songEntity({ artistId: 10, artistName: 'Tame Impala', trackId: 2 }),
    albumEntity({ artistId: 10, artistName: 'Tame Impala', collectionId: 2 }),
  ]);
  assert.deepEqual(
    artists.map((a) => a.title),
    ['Tame Impala', 'ZHU'],
  );
});

test('deriveArtists yields unique navigable artist rows from mixed entities', () => {
  const artists = deriveArtists([
    albumEntity({ artistId: 10, artistName: 'Tame Impala' }),
    songEntity({ artistId: 10 }), // same artist → deduped
    songEntity({ artistId: 20, artistName: 'Pond' }),
    { wrapperType: 'track', trackId: 5, trackName: 'x' }, // no artistId → skipped
  ]);
  assert.deepEqual(
    artists.map((a) => ({ id: a.id, title: a.title, kind: a.kind })),
    [
      { id: '10', title: 'Tame Impala', kind: 'artist' },
      { id: '20', title: 'Pond', kind: 'artist' },
    ],
  );
});

test('parseAlbumTracks drops the collection wrapper and orders by track number', () => {
  const json = {
    results: [
      albumEntity(), // leading collection wrapper — dropped
      songEntity({ trackId: 102, trackName: 'Eventually', trackNumber: 3 }),
      songEntity({ trackId: 100, trackName: 'Let It Happen', trackNumber: 1 }),
    ],
  };
  const tracks = parseAlbumTracks(json);
  assert.deepEqual(
    tracks.map((t) => t.trackNumber),
    [1, 3],
  );
  assert.equal(tracks[0].title, 'Let It Happen');
  assert.equal(tracks[0].durationMs, 467000);
});

test('parseArtistAlbums sorts newest first', () => {
  const json = {
    results: [
      albumEntity({ collectionId: 1, collectionName: 'Old', releaseDate: '2010-01-01T00:00:00Z' }),
      albumEntity({ collectionId: 2, collectionName: 'New', releaseDate: '2020-01-01T00:00:00Z' }),
    ],
  };
  assert.deepEqual(
    parseArtistAlbums(json).map((a) => a.title),
    ['New', 'Old'],
  );
});

// --- catalog (network shape) ------------------------------------------------

test('searchAlbums hits the album entity endpoint and parses', async () => {
  let url = '';
  const cat = new ITunesCatalog(async (u) => {
    url = String(u);
    return jsonResponse({ results: [albumEntity()] });
  });
  const r = await cat.searchAlbums('currents', { limit: 5 });
  assert.match(url, /entity=album/);
  assert.match(url, /limit=5/);
  assert.equal(r[0].kind, 'album');
});

test('searchTracks passes results through the enricher', async () => {
  const enricher: PopularityEnricher = {
    async enrich(songs) {
      return songs.map((s) => ({ ...s, popularity: 88 }));
    },
  };
  const cat = new ITunesCatalog(
    async () => jsonResponse({ results: [songEntity()] }),
    enricher,
  );
  const r = await cat.searchTracks('let it happen');
  assert.equal(r[0].popularity, 88);
});

test('searchAll fires album+song in parallel and returns artists, albums, songs', async () => {
  const urls: string[] = [];
  const cat = new ITunesCatalog(async (u) => {
    const s = String(u);
    urls.push(s);
    if (s.includes('entity=album')) return jsonResponse({ results: [albumEntity()] });
    return jsonResponse({ results: [songEntity()] });
  });
  const r = await cat.searchAll('tame impala');
  assert.equal(urls.length, 2);
  assert.deepEqual(
    r.map((x) => x.kind),
    ['artist', 'album', 'song'],
  );
});

test('getArtistAlbums / getAlbumTracks use the lookup endpoint', async () => {
  const urls: string[] = [];
  const cat = new ITunesCatalog(async (u) => {
    urls.push(String(u));
    return jsonResponse({ results: [albumEntity(), songEntity()] });
  });
  await cat.getArtistAlbums('10');
  await cat.getAlbumTracks('1');
  assert.match(urls[0], /\/lookup\?id=10&entity=album/);
  assert.match(urls[1], /\/lookup\?id=1&entity=song/);
});

test('getAlbumTracks resolves a non-numeric (seeded MBID) id via title+artist search', async () => {
  const urls: string[] = [];
  const cat = new ITunesCatalog(async (u) => {
    const s = String(u);
    urls.push(s);
    // First: an album search resolving the UUID to iTunes collection 1.
    if (s.includes('entity=album')) return jsonResponse({ results: [albumEntity()] });
    // Then: the tracklist lookup against that resolved id.
    return jsonResponse({ results: [albumEntity(), songEntity()] });
  });
  const tracks = await cat.getAlbumTracks('08aa7a6c-3e43-4459-87b2-e47faf3a088a', {
    title: 'Currents',
    artist: 'Tame Impala',
  });
  assert.match(urls[0], /\/search\?term=Tame%20Impala%20Currents&media=music&entity=album&limit=5/);
  assert.match(urls[1], /\/lookup\?id=1&entity=song/);
  assert.equal(tracks.length, 1);
  assert.equal(tracks[0].id, '100');
});

test('getAlbumTracks prefers an exact album-title match over iTunes top result', async () => {
  const cat = new ITunesCatalog(async (u) => {
    const s = String(u);
    if (s.includes('entity=album')) {
      // Top result is a remix EP; the exact "Currents" album comes second.
      return jsonResponse({
        results: [
          albumEntity({ collectionId: 9, collectionName: 'Currents B-Sides & Remixes - EP' }),
          albumEntity({ collectionId: 1, collectionName: 'Currents' }),
        ],
      });
    }
    // Tracklist lookup: encode the resolved id into the track so the assertion
    // can tell which album (1 vs 9) getAlbumTracks looked up.
    const id = Number(new URL(s).searchParams.get('id'));
    return jsonResponse({ results: [songEntity({ trackId: id * 1000, collectionId: id })] });
  });
  const tracks = await cat.getAlbumTracks('some-mbid-uuid', { title: 'Currents', artist: 'Tame Impala' });
  assert.equal(tracks.length, 1);
  // Resolved to collection 1 (exact "Currents"), not 9 (the remix EP top hit).
  assert.equal(tracks[0].id, '1000');
});

test('getAlbumTracks with a non-numeric id and no title/artist returns [] without fetching', async () => {
  const cat = new ITunesCatalog(async () => {
    throw new Error('should not fetch');
  });
  assert.deepEqual(await cat.getAlbumTracks('08aa7a6c-3e43-4459-87b2-e47faf3a088a'), []);
});

test('blank inputs short-circuit without any fetch', async () => {
  const cat = new ITunesCatalog(async () => {
    throw new Error('should not fetch');
  });
  assert.deepEqual(await cat.searchAlbums('   '), []);
  assert.deepEqual(await cat.searchTracks(''), []);
  assert.deepEqual(await cat.getArtistAlbums('  '), []);
  assert.deepEqual(await cat.getAlbumTracks(''), []);
});

test('a non-ok status surfaces as MusicCatalogError', async () => {
  const cat = new ITunesCatalog(async () => jsonResponse({}, { ok: false, status: 503 }));
  await assert.rejects(() => cat.searchAlbums('x'), MusicCatalogError);
});

test('an AbortError propagates (not wrapped) so the search hook can ignore it', async () => {
  const cat = new ITunesCatalog(async () => {
    const e = new Error('aborted');
    e.name = 'AbortError';
    throw e;
  });
  await assert.rejects(() => cat.searchTracks('x'), (e: Error) => e.name === 'AbortError');
});
