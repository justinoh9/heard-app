import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet } from 'react-native';

import { usePreview } from '@/audio/preview';
import { useTheme } from '@/hooks/use-theme';

/**
 * Tap-to-preview play/pause for a 30s clip (ROADMAP F2). Renders nothing when
 * the item has no preview URL (common on newer releases). Shows a pause icon
 * only while *this* clip is the one sounding — the shared player guarantees one
 * at a time. `size` scales the touch target for dense rows vs. item headers.
 */
export function PreviewButton({
  url,
  size = 22,
  color,
}: {
  url?: string;
  size?: number;
  color?: string;
}) {
  const theme = useTheme();
  const { activeUrl, playing, toggle } = usePreview();

  if (!url) return null;
  const isActive = activeUrl === url && playing;
  const tint = color ?? theme.accent;

  return (
    <Pressable
      testID="preview-toggle"
      onPress={() => toggle(url)}
      accessibilityLabel={isActive ? 'Pause preview' : 'Play 30-second preview'}
      hitSlop={8}
      style={({ pressed }) => [styles.btn, { opacity: pressed ? 0.6 : 1 }]}>
      <Ionicons name={isActive ? 'pause-circle' : 'play-circle'} size={size} color={tint} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: { padding: 2 },
});
