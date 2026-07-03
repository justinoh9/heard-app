/**
 * Hand-drawn line-art doodles for empty states — the HEYTEA-style "authentic
 * sketch" layer. Deliberately wobbly paths (circles drawn as slightly-off
 * cubics, doubled strokes, stray motion ticks) so they read as pen drawings,
 * not icons. Each doodle gets exactly one accent-colored detail; everything
 * else stays in the muted ink of the current palette.
 */

import Svg, { Circle, Line, Path } from 'react-native-svg';

import { useTheme } from '@/hooks/use-theme';

interface DoodleProps {
  size?: number;
}

/** A spinning record with a stray groove — "nothing rated yet". */
export function VinylDoodle({ size = 76 }: DoodleProps) {
  const theme = useTheme();
  const ink = theme.textSecondary;
  return (
    <Svg width={size} height={size} viewBox="0 0 96 96" fill="none">
      <Path
        d="M48 12 C 69 10, 85 26, 84 47 C 85 68, 68 85, 47 84 C 27 85, 11 67, 12 47 C 11 27, 28 11, 48 12 Z"
        stroke={ink}
        strokeWidth={2.6}
        strokeLinecap="round"
      />
      <Path
        d="M28 46 C 27 35, 36 26, 46 26 M68 50 C 68 60, 60 69, 50 70"
        stroke={ink}
        strokeWidth={1.6}
        strokeLinecap="round"
        opacity={0.55}
      />
      <Path
        d="M48 36 C 55 36, 60 41, 60 48 C 60 55, 54 60, 48 60 C 41 60, 36 54, 36 48 C 36 41, 41 36, 48 36 Z"
        stroke={theme.accent}
        strokeWidth={2.4}
        strokeLinecap="round"
      />
      <Circle cx={48} cy={48} r={2.4} fill={ink} />
      <Path
        d="M88 30 C 91 27, 92 24, 92 20 M90 40 C 93 39, 95 37, 96 35"
        stroke={ink}
        strokeWidth={1.8}
        strokeLinecap="round"
        opacity={0.6}
      />
    </Svg>
  );
}

/** A mic with sound ticks — "no shows logged". */
export function MicDoodle({ size = 76 }: DoodleProps) {
  const theme = useTheme();
  const ink = theme.textSecondary;
  return (
    <Svg width={size} height={size} viewBox="0 0 96 96" fill="none">
      <Path
        d="M36 30 C 35 20, 42 13, 49 13 C 57 13, 63 20, 62 30 L 61 46 C 61 54, 55 59, 49 59 C 42 59, 37 53, 37 46 Z"
        stroke={ink}
        strokeWidth={2.6}
        strokeLinecap="round"
      />
      <Path
        d="M38 26 L 61 25 M38 34 L 60 33"
        stroke={ink}
        strokeWidth={1.5}
        strokeLinecap="round"
        opacity={0.55}
      />
      <Path
        d="M27 46 C 27 59, 37 68, 49 68 C 61 68, 71 59, 71 47"
        stroke={theme.accent}
        strokeWidth={2.4}
        strokeLinecap="round"
      />
      <Line x1={49} y1={68} x2={49} y2={82} stroke={ink} strokeWidth={2.4} strokeLinecap="round" />
      <Path d="M38 83 C 45 81, 53 81, 60 83" stroke={ink} strokeWidth={2.4} strokeLinecap="round" />
      <Path
        d="M76 18 L 81 13 M80 26 C 83 25, 85 24, 87 22 M18 20 L 14 16"
        stroke={ink}
        strokeWidth={1.8}
        strokeLinecap="round"
        opacity={0.6}
      />
    </Svg>
  );
}

/** A cassette with a tape loop — search / generic music emptiness. */
export function CassetteDoodle({ size = 76 }: DoodleProps) {
  const theme = useTheme();
  const ink = theme.textSecondary;
  return (
    <Svg width={size} height={size} viewBox="0 0 96 96" fill="none">
      <Path
        d="M14 28 C 13 26, 15 23, 17 23 L 79 22 C 82 22, 84 24, 84 27 L 85 62 C 85 65, 83 67, 80 67 L 18 68 C 15 68, 13 66, 13 63 Z"
        stroke={ink}
        strokeWidth={2.6}
        strokeLinecap="round"
      />
      <Path
        d="M22 32 L 75 31"
        stroke={ink}
        strokeWidth={1.5}
        strokeLinecap="round"
        opacity={0.55}
      />
      <Path
        d="M33 42 C 37 42, 40 45, 40 49 C 40 53, 36 56, 33 56 C 29 56, 26 52, 26 49 C 26 45, 29 42, 33 42 Z"
        stroke={theme.accent}
        strokeWidth={2.2}
        strokeLinecap="round"
      />
      <Path
        d="M64 42 C 68 42, 71 45, 71 49 C 71 53, 67 56, 64 56 C 60 56, 57 52, 57 49 C 57 45, 60 42, 64 42 Z"
        stroke={theme.accent}
        strokeWidth={2.2}
        strokeLinecap="round"
      />
      <Path
        d="M40 49 L 57 49"
        stroke={ink}
        strokeWidth={1.5}
        strokeLinecap="round"
        opacity={0.55}
      />
      <Path
        d="M30 76 C 40 82, 58 82, 67 75"
        stroke={ink}
        strokeWidth={1.8}
        strokeLinecap="round"
        opacity={0.6}
      />
    </Svg>
  );
}

export type DoodleName = 'vinyl' | 'mic' | 'cassette';

export function Doodle({ name, size }: { name: DoodleName; size?: number }) {
  if (name === 'vinyl') return <VinylDoodle size={size} />;
  if (name === 'mic') return <MicDoodle size={size} />;
  return <CassetteDoodle size={size} />;
}
