/**
 * Venue autocomplete + geocoding — the `VenueGeocoder` seam (ROADMAP Phase 3,
 * concert map).
 *
 * Runs on **Photon** (photon.komoot.io), an OpenStreetMap geocoder chosen for
 * the same reasons as the iTunes catalog: keyless, no backend, no secret in the
 * bundle, and it sends `Access-Control-Allow-Origin: *` so a direct `fetch`
 * works on web as well as native. Nominatim is the better-known OSM geocoder
 * but its usage policy forbids autocomplete-style per-keystroke queries;
 * Photon exists specifically for that shape.
 *
 * The transport is thin on purpose — `parsePhoton` holds every mapping decision
 * and is pure, so the interesting half is unit-tested offline.
 */

/** One autocomplete hit: a real place with coordinates. */
export interface VenueSuggestion {
  /** Stable-enough key for lists (OSM type+id, else the projected position). */
  id: string;
  /** The venue name, e.g. "Madison Square Garden". */
  name: string;
  /** Best-effort locality, e.g. "New York". */
  city?: string;
  country?: string;
  lat: number;
  lng: number;
  /** One-line "New York, United States" for the suggestion row's subtitle. */
  label: string;
}

export interface VenueGeocoder {
  /**
   * Places matching `query`, best first. Returns [] rather than throwing on a
   * network/parse failure — autocomplete is an assist, never a blocker: a
   * hand-typed venue still logs fine, it just gets no map dot.
   */
  search(query: string, signal?: AbortSignal): Promise<VenueSuggestion[]>;
}

const PHOTON_URL = 'https://photon.komoot.io/api/';
/** Photon ranks well; more than this is noise in a modal list. */
const LIMIT = 6;

/** Raw Photon GeoJSON, narrowed to the fields we read. */
interface PhotonFeature {
  geometry?: { coordinates?: unknown };
  properties?: Record<string, unknown>;
}

function str(v: unknown): string | undefined {
  return typeof v === 'string' && v.trim().length > 0 ? v.trim() : undefined;
}

/**
 * Map a Photon FeatureCollection to suggestions.
 *
 * Defensive by design — this parses a third-party payload we don't control, so
 * every field is checked rather than asserted. Drops anything unusable: a
 * feature with no name is a bare coordinate the user can't recognize, and one
 * with out-of-range or non-finite coordinates would poison the map's bounds.
 */
export function parsePhoton(json: unknown): VenueSuggestion[] {
  const features = (json as { features?: unknown })?.features;
  if (!Array.isArray(features)) return [];

  const out: VenueSuggestion[] = [];
  const seen = new Set<string>();

  for (const f of features as PhotonFeature[]) {
    const props = f?.properties;
    if (!props) continue;

    const name = str(props.name);
    if (!name) continue;

    const coords = f?.geometry?.coordinates;
    if (!Array.isArray(coords) || coords.length < 2) continue;
    // GeoJSON is [lng, lat] — the reversed order is the classic geocoding bug.
    const lng = Number(coords[0]);
    const lat = Number(coords[1]);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
    if (Math.abs(lat) > 90 || Math.abs(lng) > 180) continue;

    // Photon puts the locality in `city` for most places, but a venue in an
    // unincorporated area falls back through district → county → state.
    const city = str(props.city) ?? str(props.district) ?? str(props.county) ?? str(props.state);
    const country = str(props.country);

    const osmType = str(props.osm_type);
    const osmId = props.osm_id;
    const id =
      osmType && (typeof osmId === 'number' || typeof osmId === 'string')
        ? `${osmType}${osmId}`
        : `${lat.toFixed(5)},${lng.toFixed(5)}`;
    // The same place can arrive twice (e.g. a node and its enclosing way).
    if (seen.has(id)) continue;
    seen.add(id);

    out.push({
      id,
      name,
      city,
      country,
      lat,
      lng,
      label: [city, country].filter(Boolean).join(', '),
    });
  }
  return out;
}

export class PhotonGeocoder implements VenueGeocoder {
  async search(query: string, signal?: AbortSignal): Promise<VenueSuggestion[]> {
    const q = query.trim();
    // One or two characters match everything — not worth a round-trip.
    if (q.length < 3) return [];

    const url = `${PHOTON_URL}?q=${encodeURIComponent(q)}&limit=${LIMIT}`;
    try {
      const res = await fetch(url, { signal });
      if (!res.ok) return [];
      return parsePhoton(await res.json());
    } catch (e: unknown) {
      // An aborted request is the normal case while typing, not a failure.
      if (signal?.aborted) return [];
      console.warn('[geocode] venue lookup failed:', e);
      return [];
    }
  }
}
