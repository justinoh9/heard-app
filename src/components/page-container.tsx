/**
 * Centers and caps a screen's content on wide viewports; a no-op on narrow
 * ones (CSS maxWidth + centering degrades gracefully with zero JS
 * branching). Wrap the children a `ScrollView`/`FlatList` renders, not the
 * scroll container itself — see call sites for the two integration patterns.
 */

import { StyleSheet, View, type ViewStyle } from 'react-native';

import { MaxContentWidth } from '@/constants/theme';

export function PageContainer({
  children,
  maxWidth = MaxContentWidth,
  style,
}: {
  children: React.ReactNode;
  maxWidth?: number;
  style?: ViewStyle;
}) {
  return (
    <View style={styles.outer}>
      <View style={[styles.inner, { maxWidth }, style]}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  outer: { width: '100%', alignItems: 'center' },
  inner: { width: '100%' },
});
