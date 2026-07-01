import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useHaptics } from '@/hooks/use-haptics';
import { useTheme } from '@/hooks/use-theme';
import type { Comment } from '@/comments';
import type { LikeSummary } from '@/likes';

function initialsFrom(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  return (parts[0][0] + (parts[1]?.[0] ?? '')).toUpperCase();
}

interface Props {
  comment: Comment;
  likeSummary?: LikeSummary;
  onToggleLike?: () => void;
}

export function CommentCard({ comment, likeSummary, onToggleLike }: Props) {
  const theme = useTheme();
  const haptics = useHaptics();
  const likedByMe = likeSummary?.likedByMe ?? false;

  function toggleLike() {
    if (!onToggleLike) return;
    haptics.selection();
    onToggleLike();
  }

  return (
    <View style={[styles.card, { backgroundColor: theme.backgroundElement }]}>
      <View style={[styles.avatar, { backgroundColor: theme.backgroundSelected }]}>
        <ThemedText type="smallBold">{initialsFrom(comment.displayName)}</ThemedText>
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <ThemedText type="smallBold">{comment.displayName}</ThemedText>
        <ThemedText type="small">{comment.body}</ThemedText>
        {onToggleLike && (
          <Pressable
            testID={`like-comment-${comment.id}`}
            onPress={toggleLike}
            hitSlop={8}
            style={({ pressed }) => [styles.likeRow, { opacity: pressed ? 0.6 : 1 }]}>
            <Ionicons
              name={likedByMe ? 'heart' : 'heart-outline'}
              size={14}
              color={likedByMe ? '#E24B4A' : theme.textSecondary}
            />
            <ThemedText type="small" themeColor="textSecondary">
              {likeSummary?.count ?? 0}
            </ThemedText>
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { flexDirection: 'row', gap: Spacing.two, padding: Spacing.three, borderRadius: 12 },
  avatar: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  likeRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
});
