import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  LastfmEnricher,
  buildPopularityMap,
  enrichResults,
  matchKey,
  normalizeTitle,
  parseTrackMatches,
  scalePopularity,
} from './lastfm';
import type { SearchResult } from './types';

const song = (over: Partial<SearchResult> = {}): SearchResult => ({
  id: 's',
  kind: 'song',
  title: 'Let It Happen',
  artist: 'Tame Impala',
  provider: 'itunes',
  ...over,
});

function jsonResponse(body: unknown, { ok = true, status = 200 } = {}): Response {
  return { ok, status, json: async () => body } as unknown as Response;
}

// --- pure helpers -----------------------------------------------------------

test('normalizeTitle strips feat/remaster suffixes and casing', () => {
  assert.equal(normalizeTitle('Let It Happen'), 'let it happen');
  assert.equal(normalizeTitle('Levitating (feat. DaBaby)'), 'levitating');
  assert.equal(normalizeTitle('Dreams [Remastered]'), 'dreams');
  assert.equal(normalizeTitle('Song - 2011 Remaster'), 'song');
});

test('matchKey joins normalized artist and title', () => {
  assert.equal(matchKey('Tame Impala', 'Let It Happen'), 'tame impala|let it happen');
});

test('scalePopularity is 0 for none, monotonic, and clamped to 100', () => {
  assert.equal(scalePopularity(0), 0);
  assert.ok(scalePopularity(1000) < scalePopularity(1_000_000));
  assert.ok(scalePopularity(50_000_000) <= 100);
});

test('parseTrackMatches handles array, single object, and missing', () => {
  assert.equal(parseTrackMatches({}).length, 0);
  assert.equal(
    parseTrackMatches({ results: { trackmatches: { track: { name: 'a', artist: 'b' } } } }).length,
    1,
  );
  assert.equal(
    parseTrackMatches({ results: { trackmatches: { track: [{ name: 'a' }, { name: 'b' }] } } }).length,
    2,
  );
});

test('buildPopularityMap keys by artist|title and keeps the higher count', () => {
  const map = buildPopularityMap([
    { artist: 'Tame Impala', name: 'Let It Happen', listeners: '100' },
    { artist: 'Tame Impala', name: 'Let It Happen', listeners: '500' }, // higher wins
    { artist: 'X', name: 'Y' }, // no listeners → skipped
  ]);
  assert.equal(map.get('tame impala|let it happen'), 500);
  assert.equal(map.size, 1);
});

test('enrichResults floats matched songs up and keeps unmatched in place (stable)', () => {
  const songs = [
    song({ id: 'a', title: 'Unknown A' }),
    song({ id: 'b', title: 'Let It Happen' }),
    song({ id: 'c', title: 'Unknown C' }),
  ];
  const map = new Map([[matchKey('Tame Impala', 'Let It Happen'), 1_000_000]]);
  const out = enrichResults(songs, map);
  assert.deepEqual(out.map((s) => s.id), ['b', 'a', 'c']);
  assert.ok((out[0].popularity ?? 0) > 0);
  assert.equal(out[1].popularity, undefined);
});

// --- enricher (network shape) ----------------------------------------------

test('enrich attaches popularity from track.search when a key is set', async () => {
  const enricher = new LastfmEnricher(
    async () =>
      jsonResponse({
        results: {
          trackmatches: {
            track: [{ name: 'Let It Happen', artist: 'Tame Impala', listeners: '2000000' }],
          },
        },
      }),
    'test-key',
  );
  const out = await enricher.enrich([song()], 'let it happen');
  assert.ok((out[0].popularity ?? 0) > 0);
});

test('enrich is a no-op pass-through with no API key (no fetch)', async () => {
  const enricher = new LastfmEnricher(async () => {
    throw new Error('should not fetch');
  }, undefined);
  const input = [song()];
  assert.equal(await enricher.enrich(input, 'q'), input);
});

test('enrich returns the input unchanged on a non-ok response', async () => {
  const enricher = new LastfmEnricher(async () => jsonResponse({}, { ok: false, status: 429 }), 'k');
  const input = [song()];
  assert.equal(await enricher.enrich(input, 'q'), input);
});

test('enrich swallows network errors but rethrows aborts', async () => {
  const netErr = new LastfmEnricher(async () => {
    throw new Error('network down');
  }, 'k');
  const input = [song()];
  assert.equal(await netErr.enrich(input, 'q'), input); // swallowed

  const aborted = new LastfmEnricher(async () => {
    const e = new Error('aborted');
    e.name = 'AbortError';
    throw e;
  }, 'k');
  await assert.rejects(() => aborted.enrich(input, 'q'), (e: Error) => e.name === 'AbortError');
});
