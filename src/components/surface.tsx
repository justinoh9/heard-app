/**
 * A theme-aware card surface. This is where a visual *mode* becomes a real
 * identity instead of a palette swap: it reads `useTreatment()` and renders the
 * active mode's chrome —
 *   Scribble → a hand-drawn, wobbly SVG border (each card drawn slightly
 *              differently, so a feed of cards looks sketched, not stamped)
 *   Jelly    → hairline + glossy top highlight + soft glow
 *   PB & J   → dashed label border
 *   Riso     → hard 0-radius print block with an offset ink shadow
 *   Classic  → quiet hairline card
 * Every *interactive* Surface (one with onPress) also gets a subtle, universal
 * interaction movement — a press-scale + hover-lift — so the whole app feels
 * responsive to touch, not just static panels.
 */

import { useMemo, useState } from 'react';
import {
  Pressable,
  StyleSheet,
  View,
  type LayoutChangeEvent,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';

import { Spacing } from '@/constants/theme';
import { useTheme, useTreatment } from '@/hooks/use-theme';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);
const SKETCH_PAD = 8;

interface SurfaceProps {
  children: React.ReactNode;
  /** Extra style merged onto the card body (e.g. a row layout). */
  style?: StyleProp<ViewStyle>;
  onPress?: () => void;
  testID?: string;
  accessibilityLabel?: string;
  /** Override the card fill (defaults to the palette's element color). */
  background?: string;
}

/**
 * A rounded rectangle whose four edges bow by a small, seeded amount — reads as
 * a marker line drawn freehand. Seed is per-card, so no two wobble the same.
 */
function sketchPath(w: number, h: number, r: number, seed: number): string {
  let s = seed || 1;
  const rnd = () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
  const j = (amt = 3) => (rnd() * 2 - 1) * amt;
  const [ty, rx, by, lx] = [j(), j(), j(), j()];
  return [
    `M ${r},0`,
    `Q ${w / 2},${ty} ${w - r},0`,
    `Q ${w},0 ${w},${r}`,
    `Q ${w + rx},${h / 2} ${w},${h - r}`,
    `Q ${w},${h} ${w - r},${h}`,
    `Q ${w / 2},${h + by} ${r},${h}`,
    `Q 0,${h} 0,${h - r}`,
    `Q ${lx},${h / 2} 0,${r}`,
    `Q 0,0 ${r},0`,
    'Z',
  ].join(' ');
}

export function Surface({ children, style, onPress, testID, accessibilityLabel, background }: SurfaceProps) {
  const theme = useTheme();
  const t = useTreatment();
  const [dims, setDims] = useState({ w: 0, h: 0 });
  const sketchSeed = useMemo(() => Math.floor(Math.random() * 100000) + 1, []);

  // Universal interaction movement: a press-scale + hover-lift on any tappable
  // card, in every mode (Jelly presses a touch deeper for its squishy feel).
  const scale = useSharedValue(1);
  const lift = useSharedValue(0);
  const interactStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }, { translateY: lift.value }],
  }));
  const pressIn = () => {
    scale.value = withSpring(t.wobble ? 0.96 : 0.98, { damping: 14, stiffness: 260 });
  };
  const pressOut = () => {
    scale.value = withSpring(1, { damping: 10, stiffness: 240 });
  };
  const hoverIn = () => {
    lift.value = withSpring(-2, { damping: 16, stiffness: 240 });
  };
  const hoverOut = () => {
    lift.value = withSpring(0, { damping: 16, stiffness: 240 });
  };

  const chrome = useMemo<ViewStyle>(() => {
    const base: ViewStyle = {
      backgroundColor: background ?? theme.backgroundElement,
      borderRadius: t.radius,
      borderWidth: t.borderWidth,
      borderStyle: t.borderStyle,
    };
    switch (t.shadow) {
      case 'sticker':
      case 'hard':
        return { ...base, borderColor: theme.text };
      case 'gel':
        return {
          ...base,
          borderColor: theme.isDark ? 'rgba(255,255,255,0.22)' : 'rgba(255,255,255,0.65)',
          overflow: 'hidden',
          shadowColor: theme.accent,
          shadowOpacity: 0.35,
          shadowRadius: 14,
          shadowOffset: { width: 0, height: 8 },
          elevation: 8,
        };
      default:
        return { ...base, borderColor: t.borderStyle === 'dashed' ? theme.accentAlt : theme.backgroundSelected };
    }
  }, [theme, t, background]);

  // ---- Sketch (hand-drawn) branch: Scribble ----
  if (t.sketch) {
    const bg = background ?? theme.backgroundElement;
    const onLayout = (e: LayoutChangeEvent) => {
      const { width, height } = e.nativeEvent.layout;
      setDims((d) => (Math.abs(d.w - width) > 0.5 || Math.abs(d.h - height) > 0.5 ? { w: width, h: height } : d));
    };
    const r = Math.max(0, Math.min(t.radius, dims.w / 2, dims.h / 2));
    const drawn = (
      <>
        {dims.w > 1 && dims.h > 1 && (
          <Svg
            pointerEvents="none"
            style={styles.sketchSvg}
            width={dims.w + SKETCH_PAD * 2}
            height={dims.h + SKETCH_PAD * 2}
            viewBox={`${-SKETCH_PAD} ${-SKETCH_PAD} ${dims.w + SKETCH_PAD * 2} ${dims.h + SKETCH_PAD * 2}`}>
            <Path
              d={sketchPath(dims.w, dims.h, r, sketchSeed)}
              fill={bg}
              stroke={theme.text}
              strokeWidth={t.borderWidth}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          </Svg>
        )}
        {children}
      </>
    );
    // A rounded-rect base fill under the SVG masks the pre-measure first frame.
    const sketchStyle = [styles.card, { backgroundColor: bg, borderRadius: t.radius }, style];
    return onPress ? (
      <AnimatedPressable
        onLayout={onLayout}
        testID={testID}
        accessibilityLabel={accessibilityLabel}
        onPress={onPress}
        onPressIn={pressIn}
        onPressOut={pressOut}
        onHoverIn={hoverIn}
        onHoverOut={hoverOut}
        style={[sketchStyle, interactStyle]}>
        {drawn}
      </AnimatedPressable>
    ) : (
      <View onLayout={onLayout} testID={testID} style={sketchStyle}>
        {drawn}
      </View>
    );
  }

  const offsetShadow = t.shadow === 'sticker' || t.shadow === 'hard';

  const body = (
    <>
      {t.shadow === 'gel' && (
        <View
          pointerEvents="none"
          style={[styles.gloss, { borderTopLeftRadius: t.radius, borderTopRightRadius: t.radius }]}
        />
      )}
      {children}
    </>
  );

  const cardStyle = [styles.card, chrome, style];

  const inner = onPress ? (
    <AnimatedPressable
      testID={testID}
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      onPressIn={pressIn}
      onPressOut={pressOut}
      onHoverIn={hoverIn}
      onHoverOut={hoverOut}
      style={[cardStyle, interactStyle]}>
      {body}
    </AnimatedPressable>
  ) : (
    <View testID={testID} style={cardStyle}>
      {body}
    </View>
  );

  if (!offsetShadow) return inner;

  // Offset block behind the card = the moodboard's `box-shadow: 4px 4px 0`.
  return (
    <View style={styles.wrapper}>
      <View pointerEvents="none" style={[styles.offset, { backgroundColor: theme.text, borderRadius: t.radius }]} />
      {inner}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { position: 'relative' },
  offset: { position: 'absolute', left: 4, top: 4, right: -4, bottom: -4 },
  card: { padding: Spacing.three, gap: Spacing.three },
  gloss: { position: 'absolute', top: 0, left: 0, right: 0, height: '45%', backgroundColor: 'rgba(255,255,255,0.16)' },
  sketchSvg: { position: 'absolute', left: -SKETCH_PAD, top: -SKETCH_PAD },
});
