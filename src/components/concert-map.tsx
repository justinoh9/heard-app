/**
 * The live-music map (ROADMAP Phase 3 — the concert wedge).
 *
 * A stylized poster of where you've seen shows: coarse coastlines in muted ink,
 * your venues as accent dots sized by how often you've been. Deliberately *not*
 * a tile map — no map SDK, no API key, no billing, and it renders identically on
 * web, native, and in the static export, using the `react-native-svg` the
 * doodles already ship.
 *
 * All geometry is pure and unit-tested in `concerts/map.ts`; this file only
 * turns those numbers into elements.
 */

import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle, G, Path } from 'react-native-svg';

import {
  WORLD_PATHS,
  mapSummary,
  unitsPerPixel,
  venuePoints,
  viewBoxFor,
  viewBoxString,
  type MapPoint,
} from '@/concerts/map';
import type { Concert } from '@/concerts/types';
import { Spacing } from '@/constants/theme';
import { useHaptics } from '@/hooks/use-haptics';
import { useTheme } from '@/hooks/use-theme';

import { ThemedText } from './themed-text';

/** Rendered height. The width follows from the fitted box's aspect ratio. */
const HEIGHT = 200;

/** Dot radius in *screen* px: a floor, plus a bump per repeat visit. */
function radiusPx(count: number): number {
  return 4 + Math.min(count - 1, 5) * 1.1;
}

export function ConcertMap({ concerts }: { concerts: Concert[] }) {
  const theme = useTheme();
  const haptics = useHaptics();
  const [selected, setSelected] = useState<string | null>(null);
  /** Measured, because the fitted box must match the real aspect exactly. */
  const [width, setWidth] = useState(0);

  const points = venuePoints(concerts);
  const summary = mapSummary(concerts, points);
  // Fit to the box we actually occupy: if the viewBox aspect disagreed with the
  // element's, SVG would letterbox it and `unitsPerPixel` — which derives scale
  // from height — would size every dot wrong.
  const view = viewBoxFor(points, width > 0 ? { aspect: width / HEIGHT } : {});
  // World units per pixel — keeps dots a constant size however far we zoom.
  const u = unitsPerPixel(view, width, HEIGHT);

  const active = points.find((p) => p.key === selected);

  /**
   * The empty world is shown, not hidden. This map is the whole point of the
   * concert layer — hiding it until someone already has a pin means nobody
   * discovers it, which is exactly backwards for the feature meant to sell the
   * app. An empty world with an invitation is the ad for logging a show.
   */
  const caption = active
    ? captionFor(active)
    : points.length > 0
      ? summaryText(summary)
      : concerts.length === 0
        ? 'Log a show and your first pin lands here.'
        : 'Pick a venue from the suggestions when you log a show to put it on the map.';

  return (
    <View style={styles.wrap}>
      <View
        onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
        style={[styles.canvas, { height: HEIGHT, backgroundColor: theme.backgroundElement }]}>
        {/* One layout pass to learn our width; an unmeasured SVG would fit to
            the wrong aspect and letterbox. */}
        {width > 0 && (
        <Svg width={width} height={HEIGHT} viewBox={viewBoxString(view)}>
          <G>
            {WORLD_PATHS.map((d, i) => (
              <Path
                key={i}
                d={d}
                fill={theme.background}
                stroke={theme.textSecondary}
                strokeWidth={u}
                strokeLinejoin="round"
                opacity={0.5}
              />
            ))}
          </G>
          {points.map((p) => {
            const r = radiusPx(p.count) * u;
            const on = p.key === selected;
            return (
              <G key={p.key}>
                {/* Halo — reads as a glow and widens the tap target. */}
                <Circle cx={p.x} cy={p.y} r={r * 2.2} fill={theme.accent} opacity={on ? 0.3 : 0.15} />
                <Circle
                  cx={p.x}
                  cy={p.y}
                  r={r}
                  fill={theme.accent}
                  stroke={theme.onAccent}
                  strokeWidth={u * 0.8}
                  onPress={() => {
                    haptics.selection();
                    setSelected(on ? null : p.key);
                  }}
                  accessibilityLabel={captionFor(p)}
                />
              </G>
            );
          })}
        </Svg>
        )}
      </View>

      <ThemedText type="small" themeColor="textSecondary" style={styles.caption}>
        {caption}
      </ThemedText>
    </View>
  );
}

/** "Madison Square Garden · 3 shows · Turnstile, Phoebe Bridgers" */
function captionFor(p: MapPoint): string {
  const shows = `${p.count} ${p.count === 1 ? 'show' : 'shows'}`;
  const artists = p.artists.slice(0, 3).join(', ');
  const more = p.artists.length > 3 ? ` +${p.artists.length - 3}` : '';
  return [p.label, shows, `${artists}${more}`].filter(Boolean).join(' · ');
}

/** Honest totals — never implies the ungeocoded shows are on the map. */
function summaryText({ places, mapped, unmapped }: ReturnType<typeof mapSummary>): string {
  const head = `${mapped} ${mapped === 1 ? 'show' : 'shows'} · ${places} ${
    places === 1 ? 'place' : 'places'
  }`;
  return unmapped > 0 ? `${head} · ${unmapped} without a venue` : head;
}

const styles = StyleSheet.create({
  wrap: { gap: Spacing.two },
  canvas: { borderRadius: 12, overflow: 'hidden' },
  caption: { textAlign: 'center' },
});
