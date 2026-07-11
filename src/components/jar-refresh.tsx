/**
 * Pull-to-refresh with a jam-jar-lid twist (Feature 4, the "jar" mechanic).
 *
 * Pull the feed down and a jar lid is revealed, *unscrewing* as you go; past the
 * threshold it pops and spins while the refresh runs, then screws back up.
 *
 * Web (the primary surface) drives this from pointer events, since RN Web has no
 * native overscroll — a header inside the scroll view grows with the drag while
 * we're pinned at the top, which reads as a pull without needing bounce. Native
 * has real overscroll + a platform spinner, so there we just use RefreshControl
 * (tinted to the palette) rather than fight the scroll gesture.
 */

import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Line, Path, Rect } from 'react-native-svg';

import { useTheme } from '@/hooks/use-theme';

const THRESHOLD = 62; // pull past this (px) to trigger a refresh
const MAX_PULL = 100; // clamp the drag so it can't run away
const REST = 68; // header height held open while the refresh runs (jar + hover room)
const RESISTANCE = 0.5; // drag feels heavier than a 1:1 follow
const UNSCREW_MS = 850; // time to thread the lid off (and back on)
const TURNS = 2.5; // full revolutions the lid makes while threading off

export function JarRefresh({
  onRefresh,
  // Long enough for the lid to thread fully off (UNSCREW_MS) plus a beat of
  // free-spin, so a fast refresh still plays the whole unscrew.
  refreshingMinMs = 1700,
  children,
  style,
  contentContainerStyle,
  testID,
}: {
  /** Kick off a reload. May be sync; the spinner still shows for a beat. */
  onRefresh: () => void | Promise<void>;
  /** Keep the jar spinning at least this long so a fast refresh still registers. */
  refreshingMinMs?: number;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  contentContainerStyle?: StyleProp<ViewStyle>;
  testID?: string;
}) {
  const [refreshing, setRefreshing] = useState(false);

  const begin = () => {
    if (refreshing) return;
    setRefreshing(true);
    const started = Date.now();
    Promise.resolve(onRefresh()).finally(() => {
      const wait = Math.max(0, refreshingMinMs - (Date.now() - started));
      setTimeout(() => setRefreshing(false), wait);
    });
  };

  // Native: real overscroll + platform spinner, tinted to the palette.
  const theme = useTheme();
  if (Platform.OS !== 'web') {
    return (
      <ScrollView
        testID={testID}
        style={style}
        contentContainerStyle={contentContainerStyle}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={begin}
            tintColor={theme.accent}
            colors={[theme.accent]}
          />
        }>
        {children}
      </ScrollView>
    );
  }

  return (
    <WebJarRefresh
      testID={testID}
      refreshing={refreshing}
      begin={begin}
      style={style}
      contentContainerStyle={contentContainerStyle}>
      {children}
    </WebJarRefresh>
  );
}

function WebJarRefresh({
  refreshing,
  begin,
  children,
  style,
  contentContainerStyle,
  testID,
}: {
  refreshing: boolean;
  begin: () => void;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  contentContainerStyle?: StyleProp<ViewStyle>;
  testID?: string;
}) {
  const theme = useTheme();
  const pull = useSharedValue(0);
  // Unscrew progress, 0 = seated on the neck → 1 = fully off. Rotation and rise
  // are BOTH derived from this one value, so they stay coupled like a thread —
  // the lid visibly turns as it climbs, instead of levitating straight up.
  const unscrew = useSharedValue(0);
  const spin = useSharedValue(0); // extra free-spin while hovering, after the threads release
  const pop = useSharedValue(1);

  // Plain refs (not shared values) for the pointer bookkeeping — it all runs on
  // the JS thread on web anyway.
  const scrollTop = useRef(0);
  const dragging = useRef(false);
  const startY = useRef(0);

  useEffect(() => {
    if (refreshing) {
      pull.value = withSpring(REST, { damping: 15, stiffness: 150 });
      // Thread off: ~2.5 turns while rising (both driven by `unscrew`), then the
      // freed lid keeps spinning above the jar for as long as the load takes.
      unscrew.value = withTiming(1, { duration: UNSCREW_MS, easing: Easing.inOut(Easing.quad) });
      spin.value = 0;
      spin.value = withDelay(
        UNSCREW_MS,
        withRepeat(withTiming(360, { duration: 900, easing: Easing.linear }), -1, false),
      );
      pop.value = withSequence(
        withDelay(UNSCREW_MS, withTiming(1.15, { duration: 120 })),
        withSpring(1, { damping: 6 }),
      );
    } else {
      // Thread back on: stop the free spin, reverse-turn down onto the neck,
      // and only close the header once the lid has finished seating.
      cancelAnimation(spin);
      spin.value = withTiming(0, { duration: 200 });
      unscrew.value = withTiming(0, { duration: UNSCREW_MS, easing: Easing.inOut(Easing.quad) });
      pull.value = withDelay(UNSCREW_MS, withTiming(0, { duration: 280, easing: Easing.out(Easing.quad) }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshing]);

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    scrollTop.current = e.nativeEvent.contentOffset.y;
  };

  // Pointer drag → pull, but only while pinned at the very top and pulling down.
  const onPointerDown = (e: { clientY: number }) => {
    if (refreshing || scrollTop.current > 0) return;
    dragging.current = true;
    startY.current = e.clientY;
  };
  const onPointerMove = (e: { clientY: number }) => {
    if (!dragging.current || refreshing) return;
    const dy = e.clientY - startY.current;
    if (dy > 0 && scrollTop.current <= 0) {
      pull.value = Math.min(MAX_PULL, dy * RESISTANCE);
    } else if (dy <= 0) {
      // They're scrolling the list, not pulling — bail out of the pull.
      dragging.current = false;
      pull.value = withTiming(0, { duration: 160 });
    }
  };
  const onPointerUp = () => {
    if (!dragging.current) return;
    dragging.current = false;
    if (pull.value >= THRESHOLD) begin();
    else pull.value = withTiming(0, { duration: 220 });
  };

  const headerStyle = useAnimatedStyle(() => ({ height: pull.value }));
  // The whole jar fades/scales in as the pull opens the header.
  const jarStyle = useAnimatedStyle(() => {
    const prog = Math.min(1, pull.value / THRESHOLD);
    return {
      opacity: Math.min(1, pull.value / 16),
      transform: [{ scale: (0.6 + prog * 0.4) * pop.value }],
    };
  });
  // The lid, side-on. It stays seated on the neck for the whole pull — the jar
  // arrives intact. Only when the refresh begins does `unscrew` thread it off:
  // rotation and rise both derive from that one value, so every degree of turn
  // buys a bit of height (reading as threads), `spin` free-spins it once it's
  // off, and the reverse plays it backwards to screw it back on. Seen edge-on,
  // each revolution shows as scaleX = cos(angle); a small z-tilt wobble sells
  // the off-axis wobble of a hand-turned lid.
  const lidStyle = useAnimatedStyle(() => {
    const angle = unscrew.value * TURNS * 360 + spin.value;
    const rad = (angle * Math.PI) / 180;
    return {
      transform: [
        { translateY: -unscrew.value * 15 },
        { rotate: `${Math.sin(rad) * 4}deg` },
        { scaleX: Math.cos(rad) },
      ],
    };
  });

  // Pointer handlers are web DOM props not in RN's View types — spread cast.
  const pointerProps = {
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onPointerLeave: onPointerUp,
    onPointerCancel: onPointerUp,
  };

  return (
    <View testID={testID} style={[styles.flex, style]} {...(pointerProps as object)}>
      <ScrollView onScroll={onScroll} scrollEventThrottle={16} contentContainerStyle={contentContainerStyle}>
        <Animated.View style={[styles.lidHeader, headerStyle]} pointerEvents="none">
          <Animated.View style={[styles.jar, jarStyle]}>
            <Animated.View style={[styles.lid, lidStyle]}>
              <JarLidSide color={theme.accent} ridge={theme.onAccent} />
            </Animated.View>
            <JarBody glass={theme.accent} jam={theme.accentAlt} shine={theme.onAccent} />
          </Animated.View>
        </Animated.View>
        {children}
      </ScrollView>
    </View>
  );
}

/** The screw-top lid seen from the side — a shallow cap with knurled ridges. */
function JarLidSide({ color, ridge }: { color: string; ridge: string }) {
  const ridges = Array.from({ length: 8 }).map((_, i) => (
    <Line
      key={i}
      x1={17 + i * 11}
      y1={16}
      x2={17 + i * 11}
      y2={31}
      stroke={ridge}
      strokeWidth={3.5}
      strokeLinecap="round"
      opacity={0.65}
    />
  ));
  return (
    <Svg width={30} height={11} viewBox="0 0 110 40">
      <Rect x={5} y={2} width={100} height={36} rx={10} fill={color} />
      {ridges}
    </Svg>
  );
}

/** The glass jar body, side-on — outlined glass, jam filling the lower half. */
function JarBody({ glass, jam, shine }: { glass: string; jam: string; shine: string }) {
  return (
    <Svg width={38} height={30} viewBox="0 0 100 78">
      <Path
        d="M24,22 L20,10 L20,4 L80,4 L80,10 L76,22 L80,30 L80,56 Q80,74 62,74 L38,74 Q20,74 20,56 L20,30 Z"
        fill={jam}
        fillOpacity={0.16}
        stroke={glass}
        strokeWidth={5}
        strokeLinejoin="round"
      />
      <Path d="M25,40 L75,40 L75,56 Q75,69 61,69 L39,69 Q25,69 25,56 Z" fill={jam} />
      <Line x1={30} y1={30} x2={30} y2={58} stroke={shine} strokeWidth={4} strokeLinecap="round" opacity={0.5} />
    </Svg>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  lidHeader: { alignItems: 'center', justifyContent: 'flex-end', overflow: 'hidden' },
  // Headroom above the lid so it can pop off and hover without clipping; the
  // lid tucks into the jar neck with a slight overlap.
  jar: { alignItems: 'center', paddingTop: 16, paddingBottom: 4 },
  lid: { marginBottom: -2, zIndex: 1 },
});
