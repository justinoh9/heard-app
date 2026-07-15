import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, View } from 'react-native';

import { Surface } from '@/components/surface';
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
  /** Present only on the viewer's own comments — renders the delete button. */
  onDelete?: () => void;
  /** Present on top-level comments only — renders the Reply button. */
  onReply?: () => void;
  /** Present on *other people's* comments — opens the report/block menu. */
  onReport?: () => void;
}

export function CommentCard({
  comment,
  likeSummary,
  onToggleLike,
  onDelete,
  onReply,
  onReport,
}: Props) {
  const theme = useTheme();
  const haptics = useHaptics();
  const likedByMe = likeSummary?.likedByMe ?? false;

  function toggleLike() {
    if (!onToggleLike) return;
    haptics.selection();
    onToggleLike();
  }

  return (
    <Surface style={styles.card}>
      <View style={[styles.avatar, { backgroundColor: theme.backgroundSelected }]}>
        <ThemedText type="smallBold">{initialsFrom(comment.displayName)}</ThemedText>
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <View style={styles.nameRow}>
          <ThemedText type="smallBold" style={{ flex: 1 }}>
            {comment.displayName}
          </ThemedText>
          {onDelete && (
            <Pressable
              testID={`delete-comment-${comment.id}`}
              onPress={onDelete}
              accessibilityLabel="Delete your comment"
              hitSlop={8}>
              <Ionicons name="trash-outline" size={14} color={theme.textSecondary} />
            </Pressable>
          )}
          {onReport && (
            <Pressable
              testID={`report-comment-${comment.id}`}
              onPress={onReport}
              accessibilityLabel={`Report or block ${comment.displayName}`}
              hitSlop={8}>
              <Ionicons name="ellipsis-horizontal" size={14} color={theme.textSecondary} />
            </Pressable>
          )}
        </View>
        <ThemedText type="small">{comment.body}</ThemedText>
        {(onToggleLike || onReply) && (
          <View style={styles.actions}>
            {onToggleLike && (
              <Pressable
                testID={`like-comment-${comment.id}`}
                onPress={toggleLike}
                hitSlop={8}
                style={({ pressed }) => [styles.likeRow, { opacity: pressed ? 0.6 : 1 }]}>
                <Ionicons
                  name={likedByMe ? 'heart' : 'heart-outline'}
                  size={14}
                  color={likedByMe ? theme.accent : theme.textSecondary}
                />
                <ThemedText type="small" themeColor="textSecondary">
                  {likeSummary?.count ?? 0}
                </ThemedText>
              </Pressable>
            )}
            {onReply && (
              <Pressable
                testID={`reply-comment-${comment.id}`}
                onPress={onReply}
                hitSlop={8}
                style={({ pressed }) => [styles.likeRow, { opacity: pressed ? 0.6 : 1 }]}>
                <Ionicons name="arrow-undo-outline" size={14} color={theme.textSecondary} />
                <ThemedText type="small" themeColor="textSecondary">
                  Reply
                </ThemedText>
              </Pressable>
            )}
          </View>
        )}
      </View>
    </Surface>
  );
}

const styles = StyleSheet.create({
  card: { flexDirection: 'row' },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  avatar: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  likeRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: Spacing.four },
});
