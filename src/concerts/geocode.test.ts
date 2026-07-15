/** Unit tests for the pure Photon response mapping (offline — no network). */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { parsePhoton } from './geocode';

// `coordinates` is required rather than defaulted: an explicit `undefined` would
// silently take a default and quietly stop testing the missing-geometry case.
function feature(props: Record<string, unknown>, coordinates: unknown) {
  return { type: 'Feature', geometry: { type: 'Point', coordinates }, properties: props };
}

/** A well-formed hit at Madison Square Garden. */
function msg(props: Record<string, unknown> = {}) {
  return feature(
    {
      osm_id: 1234,
      osm_type: 'W',
      name: 'Madison Square Garden',
      city: 'New York',
      state: 'New York',
      country: 'United States',
      countrycode: 'US',
      ...props,
    },
    [-73.9934, 40.7505],
  );
}

const MSG = msg();

describe('parsePhoton', () => {
  it('maps a venue hit, reading GeoJSON [lng, lat] in the right order', () => {
    const [v] = parsePhoton({ features: [MSG] });
    assert.equal(v.name, 'Madison Square Garden');
    assert.equal(v.city, 'New York');
    assert.equal(v.country, 'United States');
    // The reversed pair is the classic geocoding bug — pin it down.
    assert.equal(v.lat, 40.7505);
    assert.equal(v.lng, -73.9934);
    assert.equal(v.label, 'New York, United States');
    assert.equal(v.id, 'W1234');
  });

  it('returns [] for junk, empty, or missing payloads', () => {
    assert.deepEqual(parsePhoton(undefined), []);
    assert.deepEqual(parsePhoton(null), []);
    assert.deepEqual(parsePhoton({}), []);
    assert.deepEqual(parsePhoton({ features: 'nope' }), []);
    assert.deepEqual(parsePhoton({ features: [] }), []);
    assert.deepEqual(parsePhoton('<html>error</html>'), []);
  });

  it('skips features a user could not recognize or place', () => {
    const parsed = parsePhoton({
      features: [
        feature({ osm_id: 1, osm_type: 'N', city: 'Nowhere' }, [0, 0]), // no name
        feature({ osm_id: 2, osm_type: 'N', name: 'Null coords' }, null),
        { type: 'Feature', properties: { name: 'No geometry at all' } },
        { type: 'Feature', geometry: { type: 'Point' }, properties: { name: 'No coords key' } },
        { type: 'Feature', geometry: { type: 'Point' }, properties: null },
        feature({ osm_id: 3, osm_type: 'N', name: 'Short coords' }, [1]),
        feature({ osm_id: 4, osm_type: 'N', name: 'Off-planet' }, [0, 91]),
        feature({ osm_id: 5, osm_type: 'N', name: 'Bad lng' }, [181, 0]),
        feature({ osm_id: 6, osm_type: 'N', name: 'Not a number' }, ['x', 'y']),
        MSG,
      ],
    });
    assert.deepEqual(
      parsed.map((v) => v.name),
      ['Madison Square Garden'],
    );
  });

  it('falls back through district → county → state for the locality', () => {
    const [district] = parsePhoton({
      features: [feature({ osm_id: 7, osm_type: 'N', name: 'A', district: 'Shibuya' }, [0, 0])],
    });
    assert.equal(district.city, 'Shibuya');

    const [county] = parsePhoton({
      features: [feature({ osm_id: 8, osm_type: 'N', name: 'B', county: 'Marin' }, [0, 0])],
    });
    assert.equal(county.city, 'Marin');

    const [state] = parsePhoton({
      features: [feature({ osm_id: 9, osm_type: 'N', name: 'C', state: 'Texas' }, [0, 0])],
    });
    assert.equal(state.city, 'Texas');

    // A named city beats every fallback when Photon sends more than one.
    const [preferred] = parsePhoton({
      features: [
        feature({ osm_id: 12, osm_type: 'N', name: 'D', city: 'Austin', state: 'Texas' }, [0, 0]),
      ],
    });
    assert.equal(preferred.city, 'Austin');
  });

  it('labels a place with no locality by country alone', () => {
    const [v] = parsePhoton({
      features: [feature({ osm_id: 10, osm_type: 'N', name: 'Glastonbury', country: 'UK' }, [0, 0])],
    });
    assert.equal(v.label, 'UK');
    assert.equal(v.city, undefined);
  });

  it('drops the duplicate when a place arrives as both a node and a way', () => {
    const parsed = parsePhoton({ features: [MSG, MSG] });
    assert.equal(parsed.length, 1);
  });

  it('keys on position when OSM ids are missing, so rows stay distinct', () => {
    const parsed = parsePhoton({
      features: [
        feature({ name: 'One' }, [-73.9934, 40.7505]),
        feature({ name: 'Two' }, [151.2153, -33.8568]),
      ],
    });
    assert.equal(parsed.length, 2);
    assert.notEqual(parsed[0].id, parsed[1].id);
  });

  it('ignores blank-string fields rather than surfacing empty labels', () => {
    const [v] = parsePhoton({
      features: [
        feature({ osm_id: 11, osm_type: 'N', name: 'Venue', city: '   ', country: '' }, [0, 0]),
      ],
    });
    assert.equal(v.city, undefined);
    assert.equal(v.label, '');
  });

  it('trims surrounding whitespace off names', () => {
    const [v] = parsePhoton({ features: [msg({ name: '  Red Rocks  ' })] });
    assert.equal(v.name, 'Red Rocks');
  });
});
