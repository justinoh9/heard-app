/**
 * Pure geometry for the live-music map (ROADMAP Phase 3 — the concert wedge).
 *
 * Everything here is offline-testable: projection, the show→dot fold, the
 * auto-fitted viewBox, and the coastline path strings. `components/concert-map.tsx`
 * is a thin renderer over these — no math lives in the component.
 *
 * Projection is equirectangular (plate carrée): x is linear in longitude, y
 * linear in latitude. It distorts area badly near the poles, which is exactly
 * why the default view crops them — and for a stylized poster of "cities I've
 * seen a show in", linear-in-lat is the honest, legible choice.
 */

import { hasCoords } from './rows';
import type { Concert } from './types';
import { WORLD, type Ring } from './world';

/** World-space canvas. 2:1 is the natural equirectangular ratio (360° × 180°). */
export const MAP_WIDTH = 1000;
export const MAP_HEIGHT = 500;

export interface Point {
  x: number;
  y: number;
}

export interface ViewBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * The default frame: the whole world minus the empty poles (no one logs a show
 * at 89°N, and keeping them wastes a third of the canvas). Cropped to roughly
 * 84°N–58°S, which still holds every inhabited city.
 */
export const WORLD_VIEW: ViewBox = {
  x: 0,
  y: ((90 - 84) / 180) * MAP_HEIGHT,
  w: MAP_WIDTH,
  h: ((84 - -58) / 180) * MAP_HEIGHT,
};

/** Project a geographic coordinate into world space. */
export function projectPoint(lat: number, lng: number): Point {
  return {
    x: ((lng + 180) / 360) * MAP_WIDTH,
    y: ((90 - lat) / 180) * MAP_HEIGHT,
  };
}

/** One dot: a place you've seen at least one show, sized by how many. */
export interface MapPoint {
  key: string;
  x: number;
  y: number;
  /** Shows logged at this spot. */
  count: number;
  /** What to call the dot — venue, else city, else the artist. */
  label: string;
  /** Artists seen here, newest first, deduped. */
  artists: string[];
}

/**
 * Round to ~100m. Two shows at the same venue geocode to bit-identical
 * coordinates in practice, but rounding means a venue re-geocoded slightly
 * differently (OSM edits, a node vs. a way) still collapses to one dot.
 */
function coordKey(lat: number, lng: number): string {
  return `${lat.toFixed(3)},${lng.toFixed(3)}`;
}

/**
 * Fold shows into map dots. Shows without coordinates are dropped — they're
 * hand-typed venues that were never geocoded, and inventing a position for them
 * would be a fabricated number on a map (goal #4).
 *
 * Expects `concerts` newest-first (what `attendedFor` returns); that ordering
 * carries through to each dot's artist list.
 */
export function venuePoints(concerts: Concert[]): MapPoint[] {
  const byPlace = new Map<string, MapPoint>();

  for (const c of concerts) {
    if (!hasCoords(c)) continue;
    const key = coordKey(c.lat, c.lng);
    const existing = byPlace.get(key);
    if (existing) {
      existing.count += 1;
      if (!existing.artists.includes(c.artistName)) existing.artists.push(c.artistName);
      continue;
    }
    const { x, y } = projectPoint(c.lat, c.lng);
    byPlace.set(key, {
      key,
      x,
      y,
      count: 1,
      label: c.venue ?? c.city ?? c.artistName,
      artists: [c.artistName],
    });
  }

  // Busiest first, so the renderer lays big dots down before small ones and a
  // one-off show never hides under a venue you haunt.
  return [...byPlace.values()].sort((a, b) => b.count - a.count || a.key.localeCompare(b.key));
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(Math.max(v, lo), hi);
}

export interface ViewBoxOptions {
  /** Target width/height. The box grows on one axis to match. */
  aspect?: number;
  /** World units of breathing room around the outermost dots. */
  padding?: number;
  /** Floor on the box's width, so one lonely dot doesn't zoom to street level. */
  minWidth?: number;
}

/**
 * Frame the map on the user's shows: someone whose gigs are all in California
 * sees California, not a world map with one speck. Falls back to the whole
 * world when there's nothing to fit.
 */
export function viewBoxFor(points: MapPoint[], opts: ViewBoxOptions = {}): ViewBox {
  const aspect = opts.aspect ?? WORLD_VIEW.w / WORLD_VIEW.h;
  const padding = opts.padding ?? 40;
  const minWidth = opts.minWidth ?? 160;

  if (points.length === 0) return { ...WORLD_VIEW };

  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const cx = (Math.min(...xs) + Math.max(...xs)) / 2;
  const cy = (Math.min(...ys) + Math.max(...ys)) / 2;

  let w = Math.max(Math.max(...xs) - Math.min(...xs) + padding * 2, minWidth);
  let h = Math.max(Math.max(...ys) - Math.min(...ys) + padding * 2, minWidth / aspect);

  // Grow (never crop) to hit the target aspect, so no dot is framed out.
  if (w / h < aspect) w = h * aspect;
  else h = w / aspect;

  // Never zoom out past the whole world; re-derive the other axis if clamped.
  if (w > MAP_WIDTH) {
    w = MAP_WIDTH;
    h = w / aspect;
  }
  if (h > MAP_HEIGHT) {
    h = MAP_HEIGHT;
    w = h * aspect;
  }

  return {
    x: clamp(cx - w / 2, 0, MAP_WIDTH - w),
    y: clamp(cy - h / 2, 0, MAP_HEIGHT - h),
    w,
    h,
  };
}

/**
 * World units per rendered pixel.
 *
 * An SVG viewBox scales its contents, so a dot with a fixed world-unit radius
 * balloons as the box zooms into one city. Multiplying a pixel size by this
 * keeps dots and strokes visually constant at any zoom.
 *
 * Takes both axes and uses the smaller scale, mirroring SVG's default
 * `preserveAspectRatio="xMidYMid meet"`. When `viewBoxFor` matched the box's
 * aspect the two agree exactly; when it couldn't — the empty-map case returns
 * the whole world regardless of aspect — SVG letterboxes, and only the
 * constraining axis reflects the real scale.
 */
export function unitsPerPixel(view: ViewBox, widthPx: number, heightPx: number): number {
  if (widthPx <= 0 || heightPx <= 0) return 1;
  const scale = Math.min(widthPx / view.w, heightPx / view.h);
  return scale > 0 ? 1 / scale : 1;
}

/** `viewBox` attribute string for an SVG. */
export function viewBoxString(v: ViewBox): string {
  const r = (n: number) => Math.round(n * 100) / 100;
  return `${r(v.x)} ${r(v.y)} ${r(v.w)} ${r(v.h)}`;
}

/** Project a coastline ring into a closed SVG path. */
export function ringToPath(ring: Ring): string {
  if (ring.length === 0) return '';
  const cmds = ring.map(([lng, lat], i) => {
    const { x, y } = projectPoint(lat, lng);
    return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)} ${y.toFixed(1)}`;
  });
  return `${cmds.join(' ')} Z`;
}

/**
 * The coastlines, projected once at module load — they never change, and
 * re-deriving them on every render would be pure waste.
 */
export const WORLD_PATHS: readonly string[] = WORLD.map((land) => ringToPath(land.ring));

/** Honest caption numbers for the map header. */
export interface MapSummary {
  /** Distinct places with a dot. */
  places: number;
  /** Shows represented on the map. */
  mapped: number;
  /** Shows with no coordinates, so absent from the map. */
  unmapped: number;
}

export function mapSummary(concerts: Concert[], points: MapPoint[]): MapSummary {
  const mapped = points.reduce((n, p) => n + p.count, 0);
  return { places: points.length, mapped, unmapped: concerts.length - mapped };
}
