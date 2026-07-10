/**
 * The "5 slices of bread" rating — a display skin over the real 0–10 score, so
 * the ranking engine (score + head-to-head comparisons) is untouched. A score
 * maps to slices as `score / 2` (10 → 5 slices), and the boundary slice fills
 * proportionally, so 8.8 reads as 4 full slices + one 40%-filled.
 *
 * Theme-aware: filled slices use the palette accent, empties use a soft fill.
 */

import { useMemo } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { ClipPath, Defs, Path, Rect } from 'react-native-svg';

import { useTheme } from '@/hooks/use-theme';

const SLICES = 5;
const MAX_SCORE = 10;
// A slice of sandwich bread / toast: a rectangular lower body with a flat,
// slightly-rounded base and straight sides, topped by a wide domed crust that
// bulges OUT past the body at the shoulders (like the 🍞 emoji) — that overhang
// is what reads as "bread" instead of a plain arch or gravestone.
const BREAD =
  'M24,90 L76,90 Q82,90 82,84 L82,54 Q90,52 90,42 Q90,16 50,16 Q10,16 10,42 Q10,52 18,54 L18,84 Q18,90 24,90 Z';

export function BreadRating({
  score,
  size = 20,
  gap = 3,
  style,
}: {
  /** The underlying 0–10 score. */
  score: number;
  /** Per-slice width/height in px. */
  size?: number;
  gap?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const value = Math.max(0, Math.min(SLICES, (score / MAX_SCORE) * SLICES));
  return (
    <View
      style={[{ flexDirection: 'row', gap }, style]}
      accessibilityRole="image"
      accessibilityLabel={`${score.toFixed(1)} out of ${MAX_SCORE} — ${value.toFixed(1)} of ${SLICES} slices`}>
      {Array.from({ length: SLICES }).map((_, i) => (
        <Slice key={i} size={size} frac={Math.max(0, Math.min(1, value - i))} />
      ))}
    </View>
  );
}

function Slice({ size, frac }: { size: number; frac: number }) {
  const theme = useTheme();
  // SVG clip ids are document-global on web, so keep them unique per instance.
  const clipId = useMemo(() => `bread-${Math.random().toString(36).slice(2, 9)}`, []);
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      <Defs>
        <ClipPath id={clipId}>
          <Rect x="0" y="0" width={100 * frac} height="100" />
        </ClipPath>
      </Defs>
      <Path d={BREAD} fill={theme.accentSoft} stroke={theme.accent} strokeWidth={5} strokeLinejoin="round" />
      {frac > 0 && <Path d={BREAD} fill={theme.accent} clipPath={`url(#${clipId})`} />}
    </Svg>
  );
}
