import { useEffect } from 'react';
import { Platform, StyleSheet, Text, type TextProps } from 'react-native';
import Animated, {
  Easing,
  makeMutable,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';

import { Fonts, ThemeColor } from '@/constants/theme';
import { useBodyFont, useDisplayFont, useTheme, useTreatment } from '@/hooks/use-theme';

export type ThemedTextProps = TextProps & {
  type?: 'default' | 'title' | 'small' | 'smallBold' | 'subtitle' | 'link' | 'linkPrimary' | 'code';
  themeColor?: ThemeColor;
};

// One global clock advances every float (each letter reads it with its own
// phase), so a whole screen of animated text costs a single loop. It stays at 0
// — every derived style static — until a wiggle mode mounts. The per-element
// `hover` factor gates it: at rest nothing moves; the clock only shows through
// where the pointer is.
const floatClock = makeMutable(0);
let floatStarted = false;
function startFloat() {
  if (floatStarted) return;
  floatStarted = true;
  // reverse:true (bounce) so it loops forever — a plain -1 repeat settles at the
  // target after the first pass on web. inOut(sin) easing softens the turns so
  // the drift never snaps direction.
  floatClock.value = withRepeat(withTiming(Math.PI * 2, { duration: 3400, easing: Easing.inOut(Easing.sin) }), -1, true);
}

// Only short strings float, so a feed doesn't animate thousands of letter nodes
// (long body copy / reviews render plain). Vertical-only, and small.
const FLOAT_MAX_LEN = 30;
const FLOAT_AMP = 1.2; // px — a subtle bob, not a wave

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
    const t = floatClock.value;
    // Two summed sines of different rates = a gentle, non-repetitive float.
    const drift = Math.sin(t + seed) * 0.7 + Math.sin(t * 0.6 + seed * 2.3) * 0.3;
    // `top` (not translate) so letters stay inline — safe even inside nested
    // <Text>, and it flows/truncates normally. `hover` (0→1) is what makes it
    // move only while the element is hovered; at rest top is 0. Web-only.
    return { top: drift * FLOAT_AMP * hover.value, position: 'relative' };
  });
  return <Animated.Text style={animated}>{ch}</Animated.Text>;
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

  useEffect(() => {
    if (treatment.wiggle) startFloat();
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

  // Per-letter float: only for a plain, short string (nested/array children and
  // long copy render normally). Letters inherit font/color from this <Text>.
  // Motion is gated on hover, so the whole thing is stationary until pointed at.
  const floatable = treatment.wiggle && typeof children === 'string' && children.length <= FLOAT_MAX_LEN;
  if (floatable) {
    const text = children as string;
    // Pointer hover is web-only and not in RN's Text types, so spread it cast.
    // On native these never fire, so the text simply stays at rest.
    const hoverProps =
      Platform.OS === 'web'
        ? {
            onPointerEnter: () => {
              hover.value = withTiming(1, { duration: 220 });
            },
            onPointerLeave: () => {
              hover.value = withTiming(0, { duration: 420 });
            },
          }
        : {};
    return (
      <Text style={baseStyle} {...(hoverProps as object)} {...rest}>
        {Array.from(text).map((ch, i) => (
          <FloatLetter key={i} ch={ch} index={i} hover={hover} />
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
