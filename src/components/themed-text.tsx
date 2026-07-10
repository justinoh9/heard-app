import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Platform, StyleSheet, Text, type TextProps } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { Fonts, ThemeColor } from '@/constants/theme';
import { useBodyFont, useDisplayFont, useTheme, useTreatment } from '@/hooks/use-theme';

export type ThemedTextProps = TextProps & {
  type?: 'default' | 'title' | 'small' | 'smallBold' | 'subtitle' | 'link' | 'linkPrimary' | 'code';
  themeColor?: ThemeColor;
};

// A one-shot "worm" ripple on hover — each letter lifts and tilts, then springs
// back and STOPS. Same playful character as the wordmark, but self-terminating:
// nothing animates once the ripple has passed, so there's no perpetual motion to
// lag anything.
const RIPPLE_LIFT = 3; // px the letter hops up at the crest
const RIPPLE_TILT = 8; // degrees of playful tilt at the crest
const RIPPLE_STAGGER = 45; // ms between adjacent letters → the wave travels across
// Per-string cap: labels/titles ripple; a long review stays plain rather than
// exploding into inline nodes (and breaking ellipsis truncation).
const FLOAT_MAX_LEN = 40;
// Letters animate a GPU-composited transform (no per-frame layout reflow), which
// needs a non-inline box — so each is inline-block on web. `whiteSpace: pre`
// stops the browser trimming a letter that IS a space (inline-blocks collapse
// their own leading/trailing whitespace), which would otherwise close the gaps
// between words on hover. Native ignores both.
const LETTER_STYLE =
  Platform.OS === 'web' ? ({ display: 'inline-block', whiteSpace: 'pre' } as object) : undefined;

function FloatLetter({ ch, index }: { ch: string; index: number }) {
  // `t` pulses 0 → 1 → 0 once, staggered by index, so a single crest travels the
  // word and settles. Driven by Reanimated's scheduler (not rAF). Because it ends
  // at 0 and never repeats, the letter is completely static afterwards.
  const t = useSharedValue(0);
  useEffect(() => {
    t.value = withDelay(
      index * RIPPLE_STAGGER,
      withSequence(
        withTiming(1, { duration: 150, easing: Easing.out(Easing.quad) }),
        withTiming(0, { duration: 340, easing: Easing.inOut(Easing.quad) }),
      ),
    );
    // Mounts fresh on each hover, so this runs once per ripple; no deps needed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const dir = index % 2 === 0 ? 1 : -1; // alternate tilt → a hand-drawn wiggle
  const animated = useAnimatedStyle(() => ({
    transform: [{ translateY: -t.value * RIPPLE_LIFT }, { rotate: `${t.value * RIPPLE_TILT * dir}deg` }],
  }));
  return <Animated.Text style={[LETTER_STYLE, animated]}>{ch}</Animated.Text>;
}

/**
 * Wrap every plain-string segment in `children` (at this level) into rippling
 * letters, passing anything else through untouched — so nested <ThemedText>,
 * icons, etc. still render. Only called while an element is actually hovered.
 */
function floatize(children: ReactNode): ReactNode {
  const wrap = (node: ReactNode, key: number): ReactNode => {
    if (typeof node === 'string' || typeof node === 'number') {
      const s = String(node);
      // Too long to ripple letter-by-letter — leave as plain text.
      if (s.length > FLOAT_MAX_LEN) return node;
      return Array.from(s).map((ch, i) => <FloatLetter key={`${key}-${i}`} ch={ch} index={i} />);
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
  // 0 at rest, eased to 1 while hovered. `active` gates whether we even render
  // the per-letter version: at rest a wiggle ThemedText is a single plain <Text>
  // (zero animated nodes), so a whole screen of them costs nothing. Only the
  // element under the pointer splits into animated letters.
  const [active, setActive] = useState(false);
  const revert = useRef<ReturnType<typeof setTimeout> | null>(null);

  const enter = () => {
    if (revert.current) {
      clearTimeout(revert.current);
      revert.current = null;
    }
    setActive(true); // mount the letters → the ripple plays once, then settles
  };
  const leave = () => {
    // Drop back to plain text a beat later, freeing the letter nodes, so a
    // re-hover replays the ripple from the start.
    revert.current = setTimeout(() => setActive(false), 700);
  };

  // Cancel a pending revert on unmount so it can't fire after we're gone.
  useEffect(() => {
    return () => {
      if (revert.current) clearTimeout(revert.current);
    };
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

  // Ripple in every wiggle-mode ThemedText, whatever the children look like.
  // Pointer hover is web-only and not in RN's Text types, so spread it cast; on
  // native these never fire, so the text just stays plain and at rest.
  if (treatment.wiggle) {
    const hoverProps =
      Platform.OS === 'web' ? { onPointerEnter: enter, onPointerLeave: leave } : {};
    return (
      <Text style={baseStyle} {...(hoverProps as object)} {...rest}>
        {active ? floatize(children) : children}
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
