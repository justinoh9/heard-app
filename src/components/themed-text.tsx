import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Platform, StyleSheet, Text, type TextProps } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
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

const FLOAT_AMP = 1.6; // px — a subtle bob
const FLOAT_PERIOD = 1500; // ms for one up (or down) leg of the bob
const FLOAT_STAGGER = 110; // ms of delay per letter → a gentle travelling undulation
// Per-string cap: labels/titles float; a long review stays plain rather than
// exploding into inline nodes (and breaking ellipsis truncation).
const FLOAT_MAX_LEN = 40;
// Letters animate a GPU-composited transform (no per-frame layout reflow), which
// needs a non-inline box — so each is inline-block on web. Native ignores it.
const LETTER_STYLE = Platform.OS === 'web' ? ({ display: 'inline-block' } as object) : undefined;

function FloatLetter({
  ch,
  index,
  hover,
}: {
  ch: string;
  index: number;
  hover: SharedValue<number>;
}) {
  // Each letter runs its own eased sine bob via Reanimated (not a shared rAF
  // clock — rAF is throttled in background tabs, Reanimated's scheduler isn't).
  // inOut(sin) easing means velocity is zero at the extremes, so there's no snap
  // at the turnaround — the motion is smooth. A per-letter start delay staggers
  // the phase so the word gently undulates instead of bobbing in lockstep.
  const bob = useSharedValue(-1);
  useEffect(() => {
    bob.value = withDelay(
      index * FLOAT_STAGGER,
      withRepeat(withTiming(1, { duration: FLOAT_PERIOD, easing: Easing.inOut(Easing.sin) }), -1, true),
    );
    // Mounts only while hovered, so this runs once per hover; no deps needed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // `hover` (0→1, eased) gates the amplitude, so on leave every letter settles
  // smoothly back to the baseline even while the bob keeps oscillating.
  const animated = useAnimatedStyle(() => ({
    transform: [{ translateY: bob.value * FLOAT_AMP * hover.value }],
  }));
  return <Animated.Text style={[LETTER_STYLE, animated]}>{ch}</Animated.Text>;
}

/**
 * Wrap every plain-string segment in `children` (at this level) into floating
 * letters, passing anything else through untouched — so nested <ThemedText>,
 * icons, etc. still render. Only called while an element is actually hovered.
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
  // 0 at rest, eased to 1 while hovered. `active` gates whether we even render
  // the per-letter version: at rest a wiggle ThemedText is a single plain <Text>
  // (zero animated nodes), so a whole screen of them costs nothing. Only the
  // element under the pointer splits into animated letters.
  const hover = useSharedValue(0);
  const [active, setActive] = useState(false);
  const revert = useRef<ReturnType<typeof setTimeout> | null>(null);

  const enter = () => {
    if (revert.current) {
      clearTimeout(revert.current);
      revert.current = null;
    }
    setActive(true);
    hover.value = withTiming(1, { duration: 240 });
  };
  const leave = () => {
    hover.value = withTiming(0, { duration: 420 });
    // Drop back to plain text once the settle finishes, freeing the letter nodes.
    revert.current = setTimeout(() => setActive(false), 480);
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

  // Float in every wiggle-mode ThemedText, whatever the children look like.
  // Pointer hover is web-only and not in RN's Text types, so spread it cast; on
  // native these never fire, so the text just stays plain and at rest.
  if (treatment.wiggle) {
    const hoverProps =
      Platform.OS === 'web' ? { onPointerEnter: enter, onPointerLeave: leave } : {};
    return (
      <Text style={baseStyle} {...(hoverProps as object)} {...rest}>
        {active ? floatize(children, hover) : children}
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
