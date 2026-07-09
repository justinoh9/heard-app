import { useEffect, useMemo } from 'react';
import { Platform, StyleSheet, Text, type TextProps } from 'react-native';
import Animated, {
  Easing,
  makeMutable,
  useAnimatedStyle,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { Fonts, ThemeColor } from '@/constants/theme';
import { useBodyFont, useDisplayFont, useTheme, useTreatment } from '@/hooks/use-theme';

export type ThemedTextProps = TextProps & {
  type?: 'default' | 'title' | 'small' | 'smallBold' | 'subtitle' | 'link' | 'linkPrimary' | 'code';
  themeColor?: ThemeColor;
};

// One global clock drives every wave (each letter reads it with its own phase),
// so a whole screen of animated text costs a single loop, not one per letter.
// It stays at 0 — all derived styles static — until a wiggle mode mounts.
const waveClock = makeMutable(0);
let waveStarted = false;
function startWave() {
  if (waveStarted) return;
  waveStarted = true;
  // reverse:true (bounce) so it loops forever — a plain -1 repeat settles at the
  // target after the first pass on web. The worm travels one way, then back.
  waveClock.value = withRepeat(withTiming(Math.PI * 2, { duration: 2800, easing: Easing.inOut(Easing.sin) }), -1, true);
}

// Only short strings wave, so a feed doesn't animate thousands of letter nodes
// (long body copy / reviews render plain). Vertical-only, smooth traveling sine.
const WAVE_MAX_LEN = 30;
const WAVE_AMP = 2.4;
const WAVE_STEP = 0.55; // radians of phase between adjacent letters → the "worm"

function WaveLetter({ ch, index }: { ch: string; index: number }) {
  const animated = useAnimatedStyle(() => ({
    // `top` (not translate) so letters stay inline — safe even inside nested
    // <Text>, and it flows/truncates normally. Web-only motion; harmless on native.
    top: Math.sin(waveClock.value + index * WAVE_STEP) * WAVE_AMP,
    position: 'relative',
  }));
  return <Animated.Text style={animated}>{ch}</Animated.Text>;
}

export function ThemedText({ style, type = 'default', themeColor, children, ...rest }: ThemedTextProps) {
  const theme = useTheme();
  const displayFont = useDisplayFont();
  const bodyFont = useBodyFont();
  const treatment = useTreatment();
  const isDisplay = type === 'title' || type === 'subtitle';

  useEffect(() => {
    if (treatment.wiggle) startWave();
  }, [treatment.wiggle]);

  const baseStyle = [
    // Headings use the display face, everything else the body face; `code`
    // overrides to mono below.
    { color: theme[themeColor ?? 'text'], fontFamily: isDisplay ? displayFont : bodyFont },
    type === 'default' && styles.default,
    type === 'title' && styles.title,
    type === 'small' && styles.small,
    type === 'smallBold' && styles.smallBold,
    type === 'subtitle' && styles.subtitle,
    type === 'link' && styles.link,
    type === 'linkPrimary' && [styles.linkPrimary, { color: theme.accent }],
    type === 'code' && styles.code,
    style,
  ];

  // Per-letter wave: only for a plain, short string (nested/array children and
  // long copy render normally). Letters inherit font/color from this <Text>.
  const waveable = treatment.wiggle && typeof children === 'string' && children.length <= WAVE_MAX_LEN;
  if (waveable) {
    const text = children as string;
    return (
      <Text style={baseStyle} {...rest}>
        {Array.from(text).map((ch, i) => (
          <WaveLetter key={i} ch={ch} index={i} />
        ))}
      </Text>
    );
  }

  return (
    <Text style={baseStyle} {...rest}>
      {children}
    </Text>
  );
}

const styles = StyleSheet.create({
  small: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: 500,
  },
  smallBold: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: 700,
  },
  default: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: 500,
  },
  // Titles + subtitles speak in the mode's display face (applied inline via
  // useDisplayFont). No fontWeight alongside the custom family — the loaded
  // file IS the weight, and Android would silently fall back otherwise.
  title: {
    fontSize: 48,
    lineHeight: 52,
  },
  subtitle: {
    fontSize: 32,
    lineHeight: 44,
  },
  link: {
    lineHeight: 30,
    fontSize: 14,
  },
  linkPrimary: {
    lineHeight: 30,
    fontSize: 14,
  },
  code: {
    fontFamily: Fonts.mono,
    fontWeight: Platform.select({ android: 700 }) ?? 500,
    fontSize: 12,
  },
});
