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

// One global clock drives every wiggling label (each reads it with its own phase),
// so a whole screen of hand-drawn text costs a single animation loop, not one
// per node. It stays at 0 — and every derived style is static — until a wiggle
// mode actually mounts and starts it.
const wiggleClock = makeMutable(0);
let wiggleStarted = false;
function startWiggle() {
  if (wiggleStarted) return;
  wiggleStarted = true;
  wiggleClock.value = withRepeat(withTiming(Math.PI * 2, { duration: 2600, easing: Easing.linear }), -1, false);
}

export function ThemedText({ style, type = 'default', themeColor, ...rest }: ThemedTextProps) {
  const theme = useTheme();
  const displayFont = useDisplayFont();
  const bodyFont = useBodyFont();
  const treatment = useTreatment();
  const isDisplay = type === 'title' || type === 'subtitle';
  const wiggle = treatment.wiggle;

  // Per-instance phase so labels bob out of sync with their neighbours (breaks
  // the "uniformly typeset" feel) — a tiny, almost-entirely-vertical drift, no
  // rotation or horizontal motion. Per-letter motion lives on the wordmark
  // (AnimatedWordmark), where it's safe from text nesting/truncation.
  const phase = useMemo(() => Math.random() * Math.PI * 2, []);

  useEffect(() => {
    if (wiggle) startWiggle();
  }, [wiggle]);

  const wiggleStyle = useAnimatedStyle(() => {
    if (!wiggle) return {};
    return { transform: [{ translateY: Math.sin(wiggleClock.value + phase) * 0.5 }] };
  });

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

  if (wiggle) {
    return <Animated.Text style={[baseStyle, wiggleStyle]} {...rest} />;
  }
  return <Text style={baseStyle} {...rest} />;
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
