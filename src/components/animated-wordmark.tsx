/**
 * The wordmark, animated letter-by-letter. Stationary at rest; on hover (web) or
 * press (touch) a pulse travels across the letters so it ripples like a worm,
 * then settles back to stationary. Each letter is its own Animated.Text in a
 * flex row, which is what makes per-letter transforms actually apply (inline
 * text can't be transformed) — safe here because a wordmark is a short, flat
 * string with no nesting or truncation.
 */

import { Pressable, StyleSheet, type StyleProp, type TextStyle } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';

const REST = -3; // pulse parked left of the first letter = every letter flat

export function AnimatedWordmark({ text, style }: { text: string; style?: StyleProp<TextStyle> }) {
  const wave = useSharedValue(REST);

  const start = () => {
    cancelAnimation(wave);
    wave.value = REST;
    wave.value = withRepeat(withTiming(text.length + 3, { duration: 950, easing: Easing.linear }), -1, false);
  };
  const stop = () => {
    cancelAnimation(wave);
    wave.value = withTiming(REST, { duration: 220 });
  };

  return (
    <Pressable
      onHoverIn={start}
      onHoverOut={stop}
      onPressIn={start}
      onPressOut={stop}
      accessibilityLabel={text}
      style={styles.row}>
      {Array.from(text).map((ch, i) => (
        <Letter key={i} ch={ch} index={i} wave={wave} style={style} />
      ))}
    </Pressable>
  );
}

function Letter({
  ch,
  index,
  wave,
  style,
}: {
  ch: string;
  index: number;
  wave: SharedValue<number>;
  style?: StyleProp<TextStyle>;
}) {
  const animated = useAnimatedStyle(() => {
    const d = wave.value - index;
    const bump = Math.exp(-(d * d) / 1.3); // gaussian crest centered on the moving pulse
    return { transform: [{ translateY: -bump * 6 }, { rotate: `${bump * (d < 0 ? 8 : -8)}deg` }] };
  });
  return <Animated.Text style={[style, animated]}>{ch === ' ' ? ' ' : ch}</Animated.Text>;
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-end' },
});
