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
// A sandwich-bread slice: flat-ish base, domed top shoulders.
const BREAD = 'M18,52 C18,26 33,14 50,14 C67,14 82,26 82,52 L82,83 C82,90 77,92 70,92 L30,92 C23,92 18,90 18,83 Z';

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
