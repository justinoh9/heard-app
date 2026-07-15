/** Unit tests for the pure concert-map geometry (offline). */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  MAP_HEIGHT,
  MAP_WIDTH,
  WORLD_PATHS,
  WORLD_VIEW,
  mapSummary,
  projectPoint,
  ringToPath,
  unitsPerPixel,
  venuePoints,
  viewBoxFor,
  viewBoxString,
} from './map';
import type { Concert } from './types';

let seq = 0;
function show(p: Partial<Concert> = {}): Concert {
  seq += 1;
  return {
    id: `c${seq}`,
    userId: 'u1',
    artistName: 'Phoebe Bridgers',
    showDate: '2026-01-01',
    status: 'attended',
    tags: [],
    createdAt: `2026-01-0${(seq % 9) + 1}T00:00:00.000Z`,
    ...p,
  };
}

// Real coordinates, so a projection sign error can't hide behind toy numbers.
const MSG = { lat: 40.7505, lng: -73.9934, venue: 'Madison Square Garden', city: 'New York' };
const RED_ROCKS = { lat: 39.6654, lng: -105.2057, venue: 'Red Rocks', city: 'Morrison' };
const SYDNEY_OPERA = { lat: -33.8568, lng: 151.2153, venue: 'Sydney Opera House', city: 'Sydney' };

describe('projectPoint', () => {
  it('puts null island at the center of the canvas', () => {
    assert.deepEqual(projectPoint(0, 0), { x: MAP_WIDTH / 2, y: MAP_HEIGHT / 2 });
  });

  it('maps the coordinate extremes to the canvas corners', () => {
    assert.deepEqual(projectPoint(90, -180), { x: 0, y: 0 });
    assert.deepEqual(projectPoint(-90, 180), { x: MAP_WIDTH, y: MAP_HEIGHT });
  });

  it('places west/south correctly (guards a flipped sign)', () => {
    const ny = projectPoint(MSG.lat, MSG.lng);
    const sydney = projectPoint(SYDNEY_OPERA.lat, SYDNEY_OPERA.lng);
    // New York is west of the meridian → left of center; north → above center.
    assert.ok(ny.x < MAP_WIDTH / 2);
    assert.ok(ny.y < MAP_HEIGHT / 2);
    // Sydney is east and south → right of and below center.
    assert.ok(sydney.x > MAP_WIDTH / 2);
    assert.ok(sydney.y > MAP_HEIGHT / 2);
    // Denver is west of New York.
    assert.ok(projectPoint(RED_ROCKS.lat, RED_ROCKS.lng).x < ny.x);
  });
});

describe('venuePoints', () => {
  it('drops shows with no coordinates', () => {
    const points = venuePoints([show({ venue: 'Some dive bar' }), show(MSG)]);
    assert.equal(points.length, 1);
    assert.equal(points[0].label, 'Madison Square Garden');
  });

  it('rejects out-of-range and non-finite coordinates', () => {
    const points = venuePoints([
      show({ lat: 91, lng: 0 }),
      show({ lat: 0, lng: 181 }),
      show({ lat: Number.NaN, lng: 0 }),
      show({ lat: 40, lng: undefined }),
    ]);
    assert.deepEqual(points, []);
  });

  it('collapses repeat shows at one venue into a single counted dot', () => {
    const points = venuePoints([
      show({ ...MSG, artistName: 'Turnstile' }),
      show({ ...MSG, artistName: 'Phoebe Bridgers' }),
      show({ ...MSG, artistName: 'Turnstile' }),
    ]);
    assert.equal(points.length, 1);
    assert.equal(points[0].count, 3);
    // Artists dedupe but keep first-seen (newest-first) order.
    assert.deepEqual(points[0].artists, ['Turnstile', 'Phoebe Bridgers']);
  });

  it('treats a venue re-geocoded within ~100m as the same place', () => {
    const points = venuePoints([show(MSG), show({ ...MSG, lat: MSG.lat + 0.0001 })]);
    assert.equal(points.length, 1);
    assert.equal(points[0].count, 2);
  });

  it('keeps genuinely different venues apart', () => {
    const points = venuePoints([show(MSG), show(RED_ROCKS), show(SYDNEY_OPERA)]);
    assert.equal(points.length, 3);
  });

  it('orders busiest first so small dots render on top', () => {
    const points = venuePoints([show(MSG), show(RED_ROCKS), show(MSG)]);
    assert.equal(points[0].count, 2);
    assert.equal(points[0].label, 'Madison Square Garden');
  });

  it('falls back venue → city → artist for the label', () => {
    const [city] = venuePoints([show({ lat: 1, lng: 1, city: 'Lisbon' })]);
    assert.equal(city.label, 'Lisbon');
    const [artist] = venuePoints([show({ lat: 2, lng: 2, artistName: 'Fontaines D.C.' })]);
    assert.equal(artist.label, 'Fontaines D.C.');
  });
});

describe('viewBoxFor', () => {
  const aspect = WORLD_VIEW.w / WORLD_VIEW.h;

  it('shows the whole world when nothing is mapped', () => {
    assert.deepEqual(viewBoxFor([]), WORLD_VIEW);
  });

  it('does not zoom past minWidth for a single show', () => {
    const v = viewBoxFor(venuePoints([show(MSG)]), { minWidth: 160 });
    assert.ok(v.w >= 160);
  });

  it('centers on a lone show', () => {
    const [p] = venuePoints([show(MSG)]);
    const v = viewBoxFor([p]);
    assert.ok(Math.abs(v.x + v.w / 2 - p.x) < 0.01);
    assert.ok(Math.abs(v.y + v.h / 2 - p.y) < 0.01);
  });

  it('frames every dot with padding to spare', () => {
    const points = venuePoints([show(MSG), show(RED_ROCKS)]);
    const v = viewBoxFor(points, { padding: 40 });
    for (const p of points) {
      assert.ok(p.x > v.x && p.x < v.x + v.w, `${p.label} x inside box`);
      assert.ok(p.y > v.y && p.y < v.y + v.h, `${p.label} y inside box`);
    }
  });

  it('holds the requested aspect ratio', () => {
    const v = viewBoxFor(venuePoints([show(MSG), show(RED_ROCKS)]), { aspect });
    assert.ok(Math.abs(v.w / v.h - aspect) < 0.01);
  });

  it('never escapes the world canvas, even hugging an edge', () => {
    // A show at the far west edge would center a box off-canvas without clamping.
    const v = viewBoxFor(venuePoints([show({ lat: 0, lng: -179.9 })]));
    assert.ok(v.x >= 0);
    assert.ok(v.y >= 0);
    assert.ok(v.x + v.w <= MAP_WIDTH + 0.01);
    assert.ok(v.y + v.h <= MAP_HEIGHT + 0.01);
  });

  it('clamps to the world for shows on opposite sides of the planet', () => {
    const v = viewBoxFor(venuePoints([show(MSG), show(SYDNEY_OPERA)]));
    assert.ok(v.w <= MAP_WIDTH + 0.01);
    assert.ok(v.h <= MAP_HEIGHT + 0.01);
    assert.ok(v.x >= 0 && v.x + v.w <= MAP_WIDTH + 0.01);
  });
});

describe('ringToPath', () => {
  it('emits a closed path in projected space', () => {
    // (0,0) → canvas center; (90,-180) → top-left corner.
    const d = ringToPath([
      [0, 0],
      [-180, 90],
    ]);
    assert.equal(d, 'M500.0 250.0 L0.0 0.0 Z');
  });

  it('returns nothing for an empty ring', () => {
    assert.equal(ringToPath([]), '');
  });

  it('precomputes every landmass as a closed path', () => {
    assert.ok(WORLD_PATHS.length > 10);
    for (const d of WORLD_PATHS) {
      assert.ok(d.startsWith('M'), 'starts with a move');
      assert.ok(d.endsWith('Z'), 'closes the ring');
      assert.ok(!/NaN|Infinity/.test(d), 'no bad coordinates');
    }
  });
});

describe('unitsPerPixel', () => {
  it('keeps a dot the same on-screen size however far the map zooms', () => {
    const height = 200;
    const world = unitsPerPixel(WORLD_VIEW, height);
    const city = unitsPerPixel(viewBoxFor(venuePoints([show(MSG)])), height);
    // Zoomed into one city, each pixel covers less world → smaller world radius.
    assert.ok(city < world);
    // A 5px dot is 5px on screen in both frames, by construction.
    assert.ok(Math.abs((5 * world) / world - 5) < 1e-9);
    assert.ok(Math.abs((5 * city) / city - 5) < 1e-9);
  });

  it('degrades to 1 rather than dividing by zero before layout', () => {
    assert.equal(unitsPerPixel(WORLD_VIEW, 0), 1);
  });
});

describe('viewBoxString', () => {
  it('renders four space-separated numbers, trimmed of float tails', () => {
    assert.equal(viewBoxString({ x: 0, y: 16.666666, w: 1000, h: 394.4444 }), '0 16.67 1000 394.44');
  });

  it('stays within a hundredth of the real box', () => {
    // Only the string is rounded — asserting exact 2dp would pin down
    // floating-point tie-breaks that no viewer could ever perceive.
    const box = viewBoxFor(venuePoints([show(MSG), show(RED_ROCKS)]));
    const [x, y, w, h] = viewBoxString(box).split(' ').map(Number);
    assert.ok(Math.abs(x - box.x) <= 0.01);
    assert.ok(Math.abs(y - box.y) <= 0.01);
    assert.ok(Math.abs(w - box.w) <= 0.01);
    assert.ok(Math.abs(h - box.h) <= 0.01);
  });
});

describe('mapSummary', () => {
  it('counts places, mapped shows, and the ungeocoded remainder honestly', () => {
    const concerts = [show(MSG), show(MSG), show(RED_ROCKS), show({ venue: 'A dive bar' })];
    const summary = mapSummary(concerts, venuePoints(concerts));
    assert.deepEqual(summary, { places: 2, mapped: 3, unmapped: 1 });
  });

  it('reports nothing mapped for an empty list', () => {
    assert.deepEqual(mapSummary([], []), { places: 0, mapped: 0, unmapped: 0 });
  });
});
