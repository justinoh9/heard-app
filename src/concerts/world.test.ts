/**
 * Tests for the hand-authored coastlines.
 *
 * These exist because the first draft *looked* fine as code and was badly wrong
 * on screen: a self-intersecting Eurasia ring painted the Mediterranean solid,
 * and Great Britain came out as an arrow. Coordinates typed by hand are data,
 * and this is the data's spec — geometry no one can eyeball in a diff.
 *
 * The helpers below are deliberately test-only: `isLand` is never needed by the
 * product (the map just fills rings), so it has no business in `world.ts`.
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { WORLD, type Ring } from './world';

type Pt = readonly [number, number];

/** Sign of the cross product — which side of a→b does c fall on. */
function orient(a: Pt, b: Pt, c: Pt): number {
  return Math.sign((b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]));
}

/**
 * True when segments a→b and c→d cross at an interior point. Deliberately
 * *proper* intersection only: coarse outlines legitimately touch and double
 * back on a shared vertex, and only a real crossing breaks the fill.
 */
function crosses(a: Pt, b: Pt, c: Pt, d: Pt): boolean {
  const d1 = orient(c, d, a);
  const d2 = orient(c, d, b);
  const d3 = orient(a, b, c);
  const d4 = orient(a, b, d);
  return d1 * d2 < 0 && d3 * d4 < 0;
}

/** Every non-adjacent segment pair in a closed ring must not cross. */
function selfIntersection(ring: Ring): [number, number] | null {
  const n = ring.length;
  const seg = (i: number): [Pt, Pt] => [ring[i], ring[(i + 1) % n]];
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      // Adjacent segments share a vertex by construction; so do the first/last.
      if (j === i + 1 || (i === 0 && j === n - 1)) continue;
      const [a, b] = seg(i);
      const [c, d] = seg(j);
      if (crosses(a, b, c, d)) return [i, j];
    }
  }
  return null;
}

/** Ray casting in geographic space — the projection is linear, so this holds. */
function pointInRing(lng: number, lat: number, ring: Ring): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > lat !== yj > lat && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

function isLand(lat: number, lng: number): boolean {
  return WORLD.some((l) => pointInRing(lng, lat, l.ring));
}

describe('world rings', () => {
  it('closes every ring with enough points to be a polygon', () => {
    for (const { name, ring } of WORLD) {
      assert.ok(ring.length >= 4, `${name} has ${ring.length} points`);
    }
  });

  it('keeps every coordinate on the planet', () => {
    for (const { name, ring } of WORLD) {
      for (const [lng, lat] of ring) {
        assert.ok(Number.isFinite(lat) && Number.isFinite(lng), `${name} has a non-finite point`);
        assert.ok(Math.abs(lat) <= 90, `${name} latitude ${lat} out of range`);
        assert.ok(Math.abs(lng) <= 180, `${name} longitude ${lng} out of range`);
      }
    }
  });

  it('never lets a ring cross itself (a self-intersection fills the sea)', () => {
    for (const { name, ring } of WORLD) {
      const hit = selfIntersection(ring);
      assert.equal(hit, null, `${name} self-intersects at segments ${hit?.join(' × ')}`);
    }
  });
});

describe('world coverage', () => {
  // Inland enough that a coarse outline should still contain them.
  const CITIES: [string, number, number][] = [
    ['Berlin', 52.52, 13.4],
    ['Paris', 48.86, 2.35],
    ['Madrid', 40.42, -3.7],
    ['Rome', 41.9, 12.5],
    ['Moscow', 55.76, 37.62],
    ['Warsaw', 52.23, 21.01],
    ['Athens', 37.98, 23.73],
    ['Istanbul', 41.01, 28.98],
    ['Chicago', 41.88, -87.63],
    ['Denver', 39.74, -104.99],
    ['Mexico City', 19.43, -99.13],
    ['São Paulo', -23.55, -46.63],
    ['Cairo', 30.04, 31.24],
    ['Nairobi', -1.29, 36.82],
    ['Delhi', 28.61, 77.21],
    ['Beijing', 39.9, 116.4],
    ['Riyadh', 24.71, 46.68],
    ['Alice Springs', -23.7, 133.88],
  ];

  for (const [name, lat, lng] of CITIES) {
    it(`puts ${name} on land`, () => {
      assert.ok(isLand(lat, lng), `${name} (${lat}, ${lng}) fell in the sea`);
    });
  }

  // Open water, far from any coast at this fidelity.
  const SEAS: [string, number, number][] = [
    // The regression that started all this: a self-intersecting Eurasia ring
    // filled the Mediterranean solid, and Rome sat in the middle of a continent.
    ['Mediterranean', 35, 15],
    ['North Atlantic', 30, -40],
    ['South Atlantic', -30, -20],
    ['Pacific', 0, -140],
    ['North Pacific', 40, -170],
    ['Indian Ocean', -20, 80],
    ['Arctic Ocean', 85, 0],
    ['Southern Ocean', -55, 0],
    ['Gulf of Guinea', -2, 0],
    ['Caribbean', 15, -75],
  ];

  for (const [name, lat, lng] of SEAS) {
    it(`keeps the ${name} wet`, () => {
      assert.ok(!isLand(lat, lng), `${name} (${lat}, ${lng}) was painted as land`);
    });
  }
});
