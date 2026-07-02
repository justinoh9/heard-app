/**
 * Unit tests for the user library: pure parsers + the SpotifyUserLibrary class
 * with injected auth/fetch (offline, same pattern as spotify.test.ts).
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  parseRecentlyPlayed,
  parseTopArtists,
  parseTopTracks,
  SpotifyUserLibrary,
  type UserTokenSource,
} from './user-library';
import { MusicCatalogError } from './types';

const track = (id: string, name = `Track ${id}`, popularity = 50) => ({
  id,
  name,
  popularity,
  album: {
    id: `al-${id}`,
    name: `Album of ${name}`,
    release_date: '2021-06-01',
    images: [{ url: `https://img/${id}/640.jpg`, width: 640, height: 640 }],
  },
  artists: [{ name: 'Some Artist' }],
});

describe('parseRecentlyPlayed', () => {
  it('maps plays to song results, most recent first', () => {
    const out = parseRecentlyPlayed({
      items: [
        { track: track('t1'), played_at: '2026-07-02T10:00:00Z' },
        { track: track('t2'), played_at: '2026-07-02T09:00:00Z' },
      ],
    });
    assert.equal(out.length, 2);
    assert.equal(out[0].id, 't1');
    assert.equal(out[0].kind, 'song');
    assert.equal(out[0].artist, 'Some Artist');
    assert.equal(out[0].albumTitle, 'Album of Track t1');
    assert.equal(out[0].year, '2021');
    assert.equal(out[1].id, 't2');
  });

  it('dedupes the same track played repeatedly, keeping the most recent', () => {
    const out = parseRecentlyPlayed({
      items: [
        { track: track('t1') },
        { track: track('t2') },
        { track: track('t1') },
        { track: track('t1') },
      ],
    });
    assert.deepEqual(
      out.map((r) => r.id),
      ['t1', 't2'],
    );
  });

  it('does NOT re-sort by popularity (recency is the point)', () => {
    const out = parseRecentlyPlayed({
      items: [
        { track: track('low', 'Low', 5) },
        { track: track('high', 'High', 95) },
      ],
    });
    assert.deepEqual(
      out.map((r) => r.id),
      ['low', 'high'],
    );
  });

  it('tolerates an empty/missing items array', () => {
    assert.deepEqual(parseRecentlyPlayed({}), []);
    assert.deepEqual(parseRecentlyPlayed({ items: [] }), []);
  });
});

describe('parseTopTracks / parseTopArtists', () => {
  it('keeps Spotify affinity order for top tracks', () => {
    const out = parseTopTracks({ items: [track('a', 'A', 10), track('b', 'B', 99)] });
    assert.deepEqual(
      out.map((r) => r.id),
      ['a', 'b'],
    );
  });

  it('maps top artists with name in title and largest image', () => {
    const out = parseTopArtists({
      items: [
        {
          id: 'ar1',
          name: 'Big Artist',
          images: [
            { url: 'https://img/small.jpg', width: 160 },
            { url: 'https://img/large.jpg', width: 640 },
          ],
        },
      ],
    });
    assert.equal(out[0].kind, 'artist');
    assert.equal(out[0].title, 'Big Artist');
    assert.equal(out[0].artist, '');
    assert.equal(out[0].coverUrl, 'https://img/large.jpg');
  });
});

function fakeAuth(overrides: Partial<UserTokenSource> = {}): UserTokenSource {
  return {
    isConfigured: () => true,
    isConnected: async () => true,
    connect: async () => true,
    disconnect: async () => undefined,
    getAccessToken: async () => 'user-token',
    ...overrides,
  };
}

function jsonResponse(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response;
}

describe('SpotifyUserLibrary', () => {
  it('requests recently-played with the user token and a capped limit', async () => {
    let captured: { url: string; auth?: string } | null = null;
    const lib = new SpotifyUserLibrary(fakeAuth(), (async (url: RequestInfo | URL, init?: RequestInit) => {
      captured = {
        url: String(url),
        auth: (init?.headers as Record<string, string>)?.Authorization,
      };
      return jsonResponse(200, { items: [{ track: track('t1') }] });
    }) as typeof fetch);

    const out = await lib.getRecentlyPlayed({ limit: 50 });
    assert.equal(out.length, 1);
    assert.ok(captured!.url.includes('/me/player/recently-played'));
    assert.ok(captured!.url.includes('limit=10'), `limit clamped to 10, got ${captured!.url}`);
    assert.equal(captured!.auth, 'Bearer user-token');
  });

  it('throws a connect message when there is no token', async () => {
    const lib = new SpotifyUserLibrary(
      fakeAuth({ getAccessToken: async () => null }),
      (async () => {
        throw new Error('must not fetch');
      }) as typeof fetch,
    );
    await assert.rejects(() => lib.getTopTracks(), MusicCatalogError);
  });

  it('disconnects and asks to reconnect on a 401', async () => {
    let disconnected = false;
    const lib = new SpotifyUserLibrary(
      fakeAuth({
        disconnect: async () => {
          disconnected = true;
        },
      }),
      (async () => jsonResponse(401, {})) as typeof fetch,
    );
    await assert.rejects(() => lib.getRecentlyPlayed(), /expired/i);
    assert.equal(disconnected, true);
  });

  it('surfaces other HTTP failures as MusicCatalogError', async () => {
    const lib = new SpotifyUserLibrary(
      fakeAuth(),
      (async () => jsonResponse(500, {})) as typeof fetch,
    );
    await assert.rejects(() => lib.getTopArtists(), MusicCatalogError);
  });
});
