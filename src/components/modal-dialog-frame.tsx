/**
 * Wraps a modal screen's root: today's full-screen sheet on narrow viewports
 * (native + mobile web, `presentation: 'modal'` in _layout.tsx handles the
 * actual navigation transition), a centered dimmed-backdrop dialog card on
 * wide viewports. Only the visual presentation changes — push/pop/back-
 * gesture behavior is identical everywhere, controlled entirely by
 * `presentation: 'modal'`, which stays unconditional in _layout.tsx.
 */

import { Platform, StyleSheet, View, type DimensionValue, type ViewStyle } from 'react-native';

import { ThemedView } from '@/components/themed-view';
import { useResponsive } from '@/hooks/use-responsive';

export function ModalDialogFrame({
  children,
  maxWidth = 520,
}: {
  children: React.ReactNode;
  maxWidth?: number;
}) {
  const { isWide } = useResponsive();

  return (
    <ThemedView style={[styles.screen, isWide && styles.wideBackdrop]}>
      <View style={[styles.card, isWide && [styles.wideCard, { maxWidth }]]}>{children}</View>
    </ThemedView>
  );
}

// `absolute`, not `fixed`: this frame is always the root of its own modal
// screen (no ancestor page-scroll to escape), and `fixed` positions relative
// to the nearest transformed ancestor per the CSS spec — the navigator's own
// screen-transition container applies a transform during/after the push
// animation, which would silently break a `fixed` backdrop's sizing.
const wideBackdrop: ViewStyle = {
  position: 'absolute',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  backgroundColor: 'rgba(0,0,0,0.5)',
  alignItems: 'center',
  justifyContent: 'center',
};

const wideCard: ViewStyle = {
  // MUST explicitly zero this out — RN style arrays merge left-to-right per
  // key, so `card`'s flex: 1 otherwise survives and the "dialog" silently
  // stretches to fill the whole backdrop instead of sizing to content.
  flex: 0,
  width: '100%',
  maxHeight: (Platform.OS === 'web' ? '85vh' : 700) as DimensionValue,
  ...(Platform.OS === 'web' ? { boxShadow: '0px 8px 40px rgba(0,0,0,0.25)' } : null),
  borderRadius: 16,
  overflow: 'hidden',
};

const styles = StyleSheet.create({
  screen: { flex: 1 },
  wideBackdrop,
  card: { flex: 1 },
  wideCard,
});
