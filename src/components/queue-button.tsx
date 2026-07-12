import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet } from 'react-native';

import { useRequireAuth } from '@/auth/use-require-auth';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useHaptics } from '@/hooks/use-haptics';
import { useTheme } from '@/hooks/use-theme';
import { useQueue } from '@/queue/store';
import type { ItemType } from '@/ranking/types';

export interface QueueTarget {
  itemId: string;
  type: ItemType;
  title: string;
  artist: string;
  artUrl?: string;
}

/**
 * One-tap "want to listen" bookmark (ROADMAP G1). Filled when queued, outline
 * otherwise; toggling gates on auth. `variant='button'` is a labelled pill for
 * item-page action rows; `variant='icon'` is a bare bookmark for dense rows
 * (search results, feed cards). Only songs/albums are queueable.
 */
export function QueueButton({
  target,
  variant = 'icon',
}: {
  target: QueueTarget;
  variant?: 'button' | 'icon';
}) {
  const theme = useTheme();
  const haptics = useHaptics();
  const { requireAuth } = useRequireAuth();
  const { isQueued, toggle } = useQueue();
  const queued = isQueued(target.itemId);

  function onPress() {
    requireAuth(() => {
      haptics.selection();
      toggle(target);
    });
  }

  const icon = queued ? 'bookmark' : 'bookmark-outline';
  const label = queued ? 'Queued' : 'Want to listen';

  if (variant === 'icon') {
    return (
      <Pressable
        testID="queue-toggle"
        onPress={onPress}
        accessibilityLabel={queued ? `Remove ${target.title} from your queue` : `Add ${target.title} to your queue`}
        hitSlop={8}
        style={({ pressed }) => [styles.iconBtn, { opacity: pressed ? 0.6 : 1 }]}>
        <Ionicons name={icon} size={20} color={queued ? theme.accent : theme.textSecondary} />
      </Pressable>
    );
  }

  return (
    <Pressable
      testID="queue-toggle"
      onPress={onPress}
      accessibilityLabel={queued ? `Remove ${target.title} from your queue` : `Add ${target.title} to your queue`}
      style={({ pressed }) => [
        styles.pill,
        {
          backgroundColor: queued ? theme.accentSoft : theme.backgroundElement,
          opacity: pressed ? 0.6 : 1,
        },
      ]}>
      <Ionicons name={icon} size={18} color={queued ? theme.accent : theme.textSecondary} />
      <ThemedText type="smallBold" style={{ color: queued ? theme.accent : theme.textSecondary }}>
        {label}
      </ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  iconBtn: { padding: 4 },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
    borderRadius: 12,
  },
});
