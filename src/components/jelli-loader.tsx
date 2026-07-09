/**
 * The loading animation: a little PB&J sandwich whose layers (bottom bread →
 * peanut butter → jelly → top bread) bob in a staggered wave, so it reads as a
 * sandwich being assembled. Built on Reanimated styled views (no SVG needed),
 * and mode-agnostic — the food colors are fixed so it always reads as PB&J
 * regardless of the active theme.
 */

import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

// Top → bottom stacking order (rendered top slice first).
const LAYERS = [
  { w: 66, h: 18, color: '#E4B978', rTop: 12, rBot: 6 }, // top bread (domed)
  { w: 60, h: 10, color: '#8E3B8E', rTop: 4, rBot: 6 }, // jelly
  { w: 58, h: 9, color: '#C88A3C', rTop: 5, rBot: 5 }, // peanut butter
  { w: 66, h: 16, color: '#E4B978', rTop: 6, rBot: 10 }, // bottom bread
];

export function JelliLoader({ scale = 1 }: { scale?: number }) {
  return (
    <View style={styles.stack} accessibilityRole="progressbar" accessibilityLabel="Loading">
      {LAYERS.map((layer, i) => (
        <Slice key={i} layer={layer} index={i} scale={scale} />
      ))}
    </View>
  );
}

function Slice({ layer, index, scale }: { layer: (typeof LAYERS)[number]; index: number; scale: number }) {
  const y = useSharedValue(0);
  useEffect(() => {
    // Staggered start so the layers ripple bottom-to-top like they're settling.
    y.value = withDelay(
      index * 120,
      withRepeat(withTiming(-6 * scale, { duration: 520, easing: Easing.inOut(Easing.quad) }), -1, true),
    );
  }, [index, scale, y]);

  const animated = useAnimatedStyle(() => ({ transform: [{ translateY: y.value }] }));

  return (
    <Animated.View
      style={[
        animated,
        {
          width: layer.w * scale,
          height: layer.h * scale,
          backgroundColor: layer.color,
          borderTopLeftRadius: layer.rTop * scale,
          borderTopRightRadius: layer.rTop * scale,
          borderBottomLeftRadius: layer.rBot * scale,
          borderBottomRightRadius: layer.rBot * scale,
          marginBottom: -3 * scale,
        },
      ]}
    />
  );
}

const styles = StyleSheet.create({
  stack: { alignItems: 'center', justifyContent: 'center' },
});
