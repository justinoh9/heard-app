/**
 * A Google AdSense display unit. Renders nothing unless all three hold:
 * running on web, EXPO_PUBLIC_ADSENSE_CLIENT is set (the loader script in
 * app/+html.tsx keys off the same var), and the placement passed a `slot` id
 * from the AdSense dashboard — so builds without ads configured are pixel-
 * identical to before, and native is never affected (mobile ads are AdMob,
 * a separate integration).
 *
 * expo-router navigates without full page loads, so each mounted unit pushes
 * itself onto the adsbygoogle queue on mount (the standard SPA pattern).
 */
import { createElement, useEffect } from 'react';
import { Platform, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';

const ADSENSE_CLIENT = process.env.EXPO_PUBLIC_ADSENSE_CLIENT;

export function AdSlot({ slot }: { slot?: string }) {
  const enabled = Platform.OS === 'web' && !!ADSENSE_CLIENT && !!slot;

  useEffect(() => {
    if (!enabled) return;
    try {
      const w = window as unknown as { adsbygoogle?: unknown[] };
      (w.adsbygoogle = w.adsbygoogle ?? []).push({});
    } catch {
      // Loader blocked (ad blockers etc.) — the slot just stays empty.
    }
  }, [enabled]);

  if (!enabled) return null;

  return (
    <View style={styles.container}>
      <ThemedText type="small" themeColor="textSecondary" style={styles.label}>
        Sponsored
      </ThemedText>
      {createElement('ins', {
        className: 'adsbygoogle',
        style: { display: 'block', width: '100%' },
        'data-ad-client': ADSENSE_CLIENT,
        'data-ad-slot': slot,
        'data-ad-format': 'auto',
        'data-full-width-responsive': 'true',
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: Spacing.one, minHeight: 90 },
  label: { fontSize: 11, textTransform: 'uppercase', letterSpacing: 1 },
});
