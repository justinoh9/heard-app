import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  base64,
  parseAlbumResults,
  parseSearchResults,
  parseTrackResults,
  pickCover,
  SpotifyCatalog,
} from './spotify';
import { MusicCatalogError } from './types';

// Credentials for the token fetch. Set for the whole file; the one test that
// checks the missing-credentials path clears and restores them itself.
process.env.EXPO_PUBLIC_SPOTIFY_CLIENT_ID = 'test-id';
process.env.EXPO_PUBLIC_SPOTIFY_CLIENT_SECRET = 'test-secret';

const img = (url: string, width: number) => ({ url, width, height: width });

const albumFixture = {
  albums: {
    items: [
      {
        id: 'al-single',
        name: 'Ditto',
        album_type: 'single',
        release_date: '2022-12-19',
        images: [img('big-single', 640), img('mid-single', 300), img('sm-single', 64)],
        artists: [{ name: 'NewJeans' }],
      },
      {
        id: 'al-album',
        name: 'Get Up',
        album_type: 'album',
        release_date: '2023-07-21',
        images: [img('big-album', 640), img('mid-album', 300)],
        artists: [{ name: 'NewJeans' }],
      },
      {
        id: 'al-collab',
        name: 'Collab',
        album_type: 'album',
        images: [],
        artists: [{ name: 'A' }, { name: 'B' }],
      },
    ],
  },
};

const trackFixture = {
  tracks: {
    items: [
      {
        id: 'tr-low',
        name: 'Deep Cut',
        popularity: 30,
        preview_url: 'https://p.scdn.co/preview.mp3',
        artists: [{ name: 'NewJeans' }],
        album: { id: 'al-x', name: 'Get Up', release_date: '2023-07-21', images: [img('t640', 640), img('t300', 300)] },
      },
      {
        id: 'tr-high',
        name: 'Ditto',
        popularity: 95,
        preview_url: null,
        artists: [{ name: 'A' }, { name: 'B' }],
        album: { id: 'al-y', name: 'Ditto', release_date: '2022-12-19', images: [] },
      },
    ],
  },
};

/** A fetch stub that answers the token endpoint and the search endpoint, counting each. */
function stubFetch(opts: { search?: unknown; searchStatus?: number; onSearch?: () => Response }) {
  const calls = { token: 0, search: 0 };
  const impl = (async (url: string) => {
    if (url.includes('accounts.spotify.com')) {
      calls.token += 1;
      return new Response(JSON.stringify({ access_token: `tok-${calls.token}`, expires_in: 3600 }), {
        status: 200,
      });
    }
    calls.search += 1;
    if (opts.onSearch) return opts.onSearch();
    return new Response(JSON.stringify(opts.search ?? {}), { status: opts.searchStatus ?? 200 });
  }) as unknown as typeof fetch;
  return { impl, calls };
}

// ---- pure parsing ----------------------------------------------------------

test('parses album title, artist, year, cover, type, provider', () => {
  const album = parseAlbumResults(albumFixture).find((x) => x.id === 'al-album')!;
  assert.equal(album.title, 'Get Up');
  assert.equal(album.artist, 'NewJeans');
  assert.equal(album.year, '2023');
  assert.equal(album.coverUrl, 'mid-album'); // 300px preferred over 640px
  assert.equal(album.primaryType, 'Album');
  assert.equal(album.provider, 'spotify');
});

test('joins multi-artist credits with commas', () => {
  const collab = parseAlbumResults(albumFixture).find((x) => x.id === 'al-collab')!;
  assert.equal(collab.artist, 'A, B');
});

test('missing release_date yields undefined year', () => {
  const collab = parseAlbumResults(albumFixture).find((x) => x.id === 'al-collab')!;
  assert.equal(collab.year, undefined);
});

test('an album with no images gets no cover and does not crash', () => {
  const collab = parseAlbumResults(albumFixture).find((x) => x.id === 'al-collab')!;
  assert.equal(collab.coverUrl, undefined);
});

test('albums sort before singles/EPs', () => {
  const r = parseAlbumResults(albumFixture);
  assert.equal(r[0].primaryType, 'Album');
  assert.equal(r[r.length - 1].primaryType, 'Single');
});

test('pickCover takes the smallest image >=200px, falling back to the widest', () => {
  assert.equal(pickCover([img('a', 640), img('b', 300), img('c', 64)]), 'b');
  assert.equal(pickCover([img('only', 64)]), 'only');
  assert.equal(pickCover([]), undefined);
  assert.equal(pickCover(undefined), undefined);
});

test('parses a track: title, artist, year, kind, provider, cover, album, popularity, preview', () => {
  const track = parseTrackResults(trackFixture).find((t) => t.id === 'tr-low')!;
  assert.equal(track.title, 'Deep Cut');
  assert.equal(track.artist, 'NewJeans');
  assert.equal(track.year, '2023');
  assert.equal(track.kind, 'song');
  assert.equal(track.provider, 'spotify');
  assert.equal(track.coverUrl, 't300');
  assert.equal(track.albumTitle, 'Get Up');
  assert.equal(track.popularity, 30);
  assert.equal(track.previewUrl, 'https://p.scdn.co/preview.mp3');
});

test('tracks are ranked by popularity, highest first', () => {
  const r = parseTrackResults(trackFixture);
  assert.equal(r[0].id, 'tr-high');
  assert.equal(r[1].id, 'tr-low');
});

test('a null preview_url and empty album images degrade gracefully', () => {
  const track = parseTrackResults(trackFixture).find((t) => t.id === 'tr-high')!;
  assert.equal(track.previewUrl, undefined);
  assert.equal(track.coverUrl, undefined);
  assert.equal(track.artist, 'A, B');
});

test('parseSearchResults concatenates albums then tracks', () => {
  const r = parseSearchResults({ ...albumFixture, ...trackFixture });
  assert.equal(r.length, 3 + 2);
  assert.equal(r[0].kind, 'album');
  assert.equal(r[r.length - 1].kind, 'song');
});

test('base64 encodes ASCII correctly', () => {
  assert.equal(base64('test-id:test-secret'), 'dGVzdC1pZDp0ZXN0LXNlY3JldA==');
});

// ---- catalog (fetch + token) ----------------------------------------------

test('empty / whitespace query returns [] without any fetch', async () => {
  const { impl, calls } = stubFetch({ search: albumFixture });
  const cat = new SpotifyCatalog(impl);
  assert.deepEqual(await cat.searchAlbums('   '), []);
  assert.equal(calls.token, 0);
  assert.equal(calls.search, 0);
});

test('searchAlbums maps a successful HTTP response', async () => {
  const { impl } = stubFetch({ search: albumFixture });
  const cat = new SpotifyCatalog(impl);
  const r = await cat.searchAlbums('newjeans');
  assert.equal(r.length, 3);
});

test('searchTracks maps a successful HTTP response', async () => {
  const { impl } = stubFetch({ search: trackFixture });
  const cat = new SpotifyCatalog(impl);
  const r = await cat.searchTracks('ditto');
  assert.equal(r.length, 2);
  assert.equal(r[0].kind, 'song');
});

test('searchAll fetches both types in a single request', async () => {
  const { impl, calls } = stubFetch({ search: { ...albumFixture, ...trackFixture } });
  const cat = new SpotifyCatalog(impl);
  const r = await cat.searchAll('newjeans');
  assert.equal(calls.search, 1); // one request, unlike MusicBrainz's two
  assert.equal(r.length, 5);
});

test('the app token is fetched once and reused across searches', async () => {
  const { impl, calls } = stubFetch({ search: albumFixture });
  const cat = new SpotifyCatalog(impl);
  await cat.searchAlbums('a');
  await cat.searchAlbums('b');
  assert.equal(calls.token, 1);
  assert.equal(calls.search, 2);
});

test('a 401 refreshes the token and retries once', async () => {
  let n = 0;
  const { impl, calls } = stubFetch({
    onSearch: () => {
      n += 1;
      return n === 1
        ? new Response('expired', { status: 401 })
        : new Response(JSON.stringify(albumFixture), { status: 200 });
    },
  });
  const cat = new SpotifyCatalog(impl);
  const r = await cat.searchAlbums('newjeans');
  assert.equal(r.length, 3);
  assert.equal(calls.token, 2); // minted once, then refreshed after the 401
  assert.equal(calls.search, 2);
});

test('non-ok search status throws a MusicCatalogError', async () => {
  const { impl } = stubFetch({ searchStatus: 503 });
  const cat = new SpotifyCatalog(impl);
  await assert.rejects(() => cat.searchAlbums('x'), MusicCatalogError);
});

test('network failure is wrapped as MusicCatalogError', async () => {
  const cat = new SpotifyCatalog((async (url: string) => {
    if (url.includes('accounts.spotify.com')) {
      return new Response(JSON.stringify({ access_token: 'tok', expires_in: 3600 }), { status: 200 });
    }
    throw new TypeError('Failed to fetch');
  }) as unknown as typeof fetch);
  await assert.rejects(() => cat.searchAlbums('x'), MusicCatalogError);
});

// ---- proxy mode (Edge Function token endpoint) ----------------------------

test('proxy mode fetches the token from the token URL, never from Spotify', async () => {
  const PROXY = 'https://proj.supabase.co/functions/v1/spotify-token';
  process.env.EXPO_PUBLIC_SPOTIFY_TOKEN_URL = PROXY;
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = 'anon-key-123';
  try {
    const hits = { proxy: 0, spotifyToken: 0, search: 0 };
    let sentAuth: string | undefined;
    const impl = (async (url: string, init?: RequestInit) => {
      if (url === PROXY) {
        hits.proxy += 1;
        sentAuth = (init?.headers as Record<string, string>)?.Authorization;
        return new Response(JSON.stringify({ access_token: 'proxy-tok', expires_in: 3600 }), { status: 200 });
      }
      if (url.includes('accounts.spotify.com')) {
        hits.spotifyToken += 1;
        return new Response('{}', { status: 200 });
      }
      hits.search += 1;
      return new Response(JSON.stringify(albumFixture), { status: 200 });
    }) as unknown as typeof fetch;
    const cat = new SpotifyCatalog(impl);
    const r = await cat.searchAlbums('newjeans');
    assert.equal(r.length, 3);
    assert.equal(hits.proxy, 1);
    assert.equal(hits.spotifyToken, 0); // the secret never leaves the server
    assert.equal(sentAuth, 'Bearer anon-key-123'); // anon key forwarded to satisfy JWT
  } finally {
    delete process.env.EXPO_PUBLIC_SPOTIFY_TOKEN_URL;
    delete process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  }
});

test('proxy mode surfaces a token-service failure as MusicCatalogError', async () => {
  const PROXY = 'https://proj.supabase.co/functions/v1/spotify-token';
  process.env.EXPO_PUBLIC_SPOTIFY_TOKEN_URL = PROXY;
  try {
    const impl = (async (url: string) => {
      if (url === PROXY) return new Response('nope', { status: 500 });
      return new Response(JSON.stringify(albumFixture), { status: 200 });
    }) as unknown as typeof fetch;
    const cat = new SpotifyCatalog(impl);
    await assert.rejects(() => cat.searchAlbums('x'), MusicCatalogError);
  } finally {
    delete process.env.EXPO_PUBLIC_SPOTIFY_TOKEN_URL;
  }
});

test('missing credentials throws a MusicCatalogError without hitting the network', async () => {
  const id = process.env.EXPO_PUBLIC_SPOTIFY_CLIENT_ID;
  const secret = process.env.EXPO_PUBLIC_SPOTIFY_CLIENT_SECRET;
  delete process.env.EXPO_PUBLIC_SPOTIFY_CLIENT_ID;
  delete process.env.EXPO_PUBLIC_SPOTIFY_CLIENT_SECRET;
  try {
    const { impl, calls } = stubFetch({ search: albumFixture });
    const cat = new SpotifyCatalog(impl);
    await assert.rejects(() => cat.searchAlbums('x'), MusicCatalogError);
    assert.equal(calls.token, 0);
  } finally {
    process.env.EXPO_PUBLIC_SPOTIFY_CLIENT_ID = id;
    process.env.EXPO_PUBLIC_SPOTIFY_CLIENT_SECRET = secret;
  }
});
