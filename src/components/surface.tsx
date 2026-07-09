/**
 * A theme-aware card surface. This is where a visual *mode* becomes a real
 * identity instead of a palette swap: it reads `useTreatment()` and renders the
 * active mode's chrome —
 *   Scribble → heavy ink border + offset "sticker" drop-shadow
 *   Jelly    → hairline + glossy top highlight + soft glow, wobble-on-tap
 *   PB & J   → dashed label border
 *   Riso     → hard 0-radius print block with an offset ink shadow
 *   Classic  → quiet hairline card
 * Content is untouched — screens wrap their card body in <Surface> and get the
 * texture for free in every theme.
 */

import { useMemo } from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

import { Spacing } from '@/constants/theme';
import { useTheme, useTreatment } from '@/hooks/use-theme';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

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

export function Surface({ children, style, onPress, testID, accessibilityLabel, background }: SurfaceProps) {
  const theme = useTheme();
  const t = useTreatment();

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

  const offsetShadow = t.shadow === 'sticker' || t.shadow === 'hard';

  const scale = useSharedValue(1);
  const wobbleStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

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
      onPressIn={() => {
        if (t.wobble) scale.value = withSpring(0.96, { damping: 12, stiffness: 260 });
      }}
      onPressOut={() => {
        if (t.wobble) scale.value = withSpring(1, { damping: 9, stiffness: 240 });
      }}
      style={[cardStyle, t.wobble ? wobbleStyle : null]}>
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
});
