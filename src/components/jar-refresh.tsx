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
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, Line } from 'react-native-svg';

import { useTheme } from '@/hooks/use-theme';

const THRESHOLD = 62; // pull past this (px) to trigger a refresh
const MAX_PULL = 96; // clamp the drag so it can't run away
const REST = 50; // header height held open while the refresh runs
const RESISTANCE = 0.5; // drag feels heavier than a 1:1 follow

export function JarRefresh({
  onRefresh,
  refreshingMinMs = 650,
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
  const spin = useSharedValue(0);
  const pop = useSharedValue(1);

  // Plain refs (not shared values) for the pointer bookkeeping — it all runs on
  // the JS thread on web anyway.
  const scrollTop = useRef(0);
  const dragging = useRef(false);
  const startY = useRef(0);

  useEffect(() => {
    if (refreshing) {
      pull.value = withSpring(REST, { damping: 15, stiffness: 150 });
      spin.value = 0;
      spin.value = withRepeat(withTiming(360, { duration: 850, easing: Easing.linear }), -1, false);
      pop.value = withSequence(withTiming(1.25, { duration: 130 }), withSpring(1, { damping: 6 }));
    } else {
      cancelAnimation(spin);
      spin.value = withTiming(0, { duration: 220 });
      pull.value = withTiming(0, { duration: 280, easing: Easing.out(Easing.quad) });
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
  const lidStyle = useAnimatedStyle(() => {
    const prog = Math.min(1, pull.value / THRESHOLD);
    // Unscrew as you pull; once refreshing, hand off to the continuous spin.
    const rotate = prog * 200 + spin.value;
    return {
      opacity: Math.min(1, pull.value / 16),
      transform: [{ scale: (0.55 + prog * 0.45) * pop.value }, { rotate: `${rotate}deg` }],
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
          <Animated.View style={lidStyle}>
            <JarLid color={theme.accent} ridge={theme.onAccent} jam={theme.accentAlt} />
          </Animated.View>
        </Animated.View>
        {children}
      </ScrollView>
    </View>
  );
}

/** A screw-top jam-jar lid, seen from above — ridged rim + a jelly dollop. */
function JarLid({ color, ridge, jam }: { color: string; ridge: string; jam: string }) {
  const ridges = Array.from({ length: 16 }).map((_, i) => {
    const a = (i / 16) * Math.PI * 2;
    return (
      <Line
        key={i}
        x1={50 + Math.cos(a) * 44}
        y1={50 + Math.sin(a) * 44}
        x2={50 + Math.cos(a) * 36}
        y2={50 + Math.sin(a) * 36}
        stroke={ridge}
        strokeWidth={3}
        strokeLinecap="round"
      />
    );
  });
  return (
    <Svg width={34} height={34} viewBox="0 0 100 100">
      <Circle cx="50" cy="50" r="45" fill={color} />
      {ridges}
      <Circle cx="50" cy="50" r="32" fill="none" stroke={ridge} strokeWidth={2.5} opacity={0.5} />
      <Circle cx="50" cy="50" r="13" fill={jam} />
    </Svg>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  lidHeader: { alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
});
