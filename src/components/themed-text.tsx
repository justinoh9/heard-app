import { useEffect, type ReactNode } from 'react';
import { Platform, StyleSheet, Text, type TextProps } from 'react-native';
import Animated, {
  makeMutable,
  runOnJS,
  useAnimatedReaction,
  useAnimatedStyle,
  useFrameCallback,
  useSharedValue,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';

import { Fonts, ThemeColor } from '@/constants/theme';
import { useBodyFont, useDisplayFont, useTheme, useTreatment } from '@/hooks/use-theme';

export type ThemedTextProps = TextProps & {
  type?: 'default' | 'title' | 'small' | 'smallBold' | 'subtitle' | 'link' | 'linkPrimary' | 'code';
  themeColor?: ThemeColor;
};

// A single global phase clock drives every floating letter. It advances
// *monotonically* (no bounce/turnaround) so the motion is perfectly smooth —
// pure sine, no velocity snap. It only ticks while at least one element is
// hovered (`hoverCount`), so at rest the page is completely still: no rAF, and
// every letter's worklet early-returns without even subscribing to the clock.
const floatClock = makeMutable(0);
const hoverCount = makeMutable(0);
const FLOAT_SPEED = 1.1; // radians per second — a slow, gentle drift
const FLOAT_AMP = 1.3; // px — a subtle bob, not a wave
// Per-string cap: labels/titles float; a long review stays plain rather than
// exploding into hundreds of inline nodes (and breaking ellipsis truncation).
const FLOAT_MAX_LEN = 40;

/**
 * Mount once (in the root layout). Owns the shared phase clock and only runs the
 * per-frame loop while something is hovered — flipped on/off by `hoverCount`.
 */
export function FloatClockDriver() {
  const frame = useFrameCallback((info) => {
    'worklet';
    const dt = (info.timeSincePreviousFrame ?? 16) / 1000;
    // Wrap on a large multiple of 2π so the summed sines stay continuous while
    // never growing unbounded (float precision).
    floatClock.value = (floatClock.value + dt * FLOAT_SPEED) % (Math.PI * 2 * 1000);
  }, false);

  useAnimatedReaction(
    () => hoverCount.value > 0,
    (active, prev) => {
      if (active !== prev) runOnJS(frame.setActive)(active);
    },
  );

  return null;
}

function FloatLetter({
  ch,
  index,
  hover,
}: {
  ch: string;
  index: number;
  hover: SharedValue<number>;
}) {
  // Per-letter phase seed (not a fixed step) so letters drift on their own
  // schedule — the word floats like it's suspended instead of rippling across.
  const seed = index * 1.7;
  const animated = useAnimatedStyle(() => {
    // Reading `hover` first and bailing at 0 means an un-hovered letter never
    // touches `floatClock`, so it isn't subscribed to it — the whole screen of
    // resting text costs nothing per frame. Only the hovered element animates.
    if (hover.value === 0) return { top: 0, position: 'relative' };
    const t = floatClock.value;
    // Two summed sines of different rates = a gentle, non-repetitive float.
    const drift = Math.sin(t + seed) * 0.7 + Math.sin(t * 0.6 + seed * 2.3) * 0.3;
    // `top` (not translate) so letters stay inline — safe even inside nested
    // <Text>, and it flows/truncates normally. Web-only motion.
    return { top: drift * FLOAT_AMP * hover.value, position: 'relative' };
  });
  return <Animated.Text style={animated}>{ch}</Animated.Text>;
}

/**
 * Wrap every plain-string segment in `children` (at this level) into floating
 * letters, passing anything else through untouched — so nested <ThemedText>,
 * icons, etc. still render, and each nested ThemedText runs its own float. This
 * is what makes the effect global: mixed/nested content floats too, not just a
 * bare short string.
 */
function floatize(children: ReactNode, hover: SharedValue<number>): ReactNode {
  let offset = 0; // keeps letter keys unique across multiple string segments
  const wrap = (node: ReactNode, key: number): ReactNode => {
    if (typeof node === 'string' || typeof node === 'number') {
      const s = String(node);
      // Too long to float letter-by-letter — leave as plain text.
      if (s.length > FLOAT_MAX_LEN) return node;
      const base = offset;
      offset += s.length;
      return Array.from(s).map((ch, i) => (
        <FloatLetter key={`${key}-${i}`} ch={ch} index={base + i} hover={hover} />
      ));
    }
    return node;
  };
  return Array.isArray(children) ? children.map(wrap) : wrap(children, 0);
}

export function ThemedText({ style, type = 'default', themeColor, children, ...rest }: ThemedTextProps) {
  const theme = useTheme();
  const displayFont = useDisplayFont();
  const bodyFont = useBodyFont();
  const treatment = useTreatment();
  const isDisplay = type === 'title' || type === 'subtitle';
  // 0 at rest, eased to 1 while this element is hovered — the float only shows
  // through where the pointer is.
  const hover = useSharedValue(0);

  // Balance the global hover ref-count on unmount if we leave while hovered
  // (e.g. navigating away mid-hover), so the clock doesn't stay running.
  useEffect(() => {
    return () => {
      if (hover.value !== 0) hoverCount.value = Math.max(0, hoverCount.value - 1);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  // Float in every wiggle-mode ThemedText, whatever the children look like —
  // plain strings, numbers, or mixed/nested content (floatize wraps the string
  // parts and passes the rest through). Hover-gated, so it's stationary at rest.
  if (treatment.wiggle) {
    // Pointer hover is web-only and not in RN's Text types, so spread it cast.
    // Each enter/leave also bumps the global count that runs the phase clock.
    // On native these never fire, so the text simply stays at rest.
    const hoverProps =
      Platform.OS === 'web'
        ? {
            onPointerEnter: () => {
              hover.value = withTiming(1, { duration: 220 });
              hoverCount.value += 1;
            },
            onPointerLeave: () => {
              hover.value = withTiming(0, { duration: 420 });
              hoverCount.value = Math.max(0, hoverCount.value - 1);
            },
          }
        : {};
    return (
      <Text style={baseStyle} {...(hoverProps as object)} {...rest}>
        {floatize(children, hover)}
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
