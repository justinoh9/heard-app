/**
 * Share-card export (ROADMAP Phase 3 "Share cards"). Captures a rendered card
 * view to a PNG and hands it off — the native share sheet on device, a file
 * download on web (the myjelli.site acquisition surface). Every exported card
 * carries the wordmark, so each share is a tiny billboard.
 *
 * Kept out of test-reachable modules: it pulls react-native-view-shot /
 * expo-sharing, which the node test runner can't load.
 */

import { Platform } from 'react-native';
import { captureRef } from 'react-native-view-shot';

/** A ref to the card view (or the view itself) to rasterize. */
type Capturable = Parameters<typeof captureRef>[0];

/**
 * Rasterize `node` to a PNG and share it. Resolves once handed off (or the
 * download starts); throws on capture failure so the caller can toast.
 */
export async function shareCard(node: Capturable, filename = 'jelli'): Promise<void> {
  if (Platform.OS === 'web') {
    const uri = await captureRef(node, { format: 'png', quality: 1, result: 'data-uri' });
    const link = document.createElement('a');
    link.href = uri;
    link.download = `${filename}.png`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    return;
  }

  const uri = await captureRef(node, { format: 'png', quality: 1, result: 'tmpfile' });
  const Sharing = await import('expo-sharing');
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(uri, {
      mimeType: 'image/png',
      dialogTitle: 'Share your Jelli card',
      UTI: 'public.png',
    });
  }
}
