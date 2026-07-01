import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { useAuth } from '@/auth/store';
import { AlbumCover } from '@/components/album-cover';
import { CommentCard } from '@/components/comment-card';
import { EmptyState } from '@/components/empty-state';
import { ScoreBreakdown } from '@/components/score-breakdown';
import { Segmented } from '@/components/segmented';
import { TextField } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { filterSortComments, useComments, type CommentScope, type CommentSort } from '@/comments';
import { Spacing } from '@/constants/theme';
import { useRatings } from '@/data/store';
import { useHaptics } from '@/hooks/use-haptics';
import { useTheme } from '@/hooks/use-theme';
import { useLikeSummaries, useLikeSummary } from '@/likes';
import type { ItemType } from '@/ranking/types';

export default function ItemProfileScreen() {
  const theme = useTheme();
  const router = useRouter();
  const haptics = useHaptics();
  const { user } = useAuth();
  const { ratingFor } = useRatings();
  const params = useLocalSearchParams<{
    id: string;
    type?: string;
    title: string;
    artist: string;
    artUrl?: string;
  }>();

  const id = String(params.id);
  const type: ItemType = (params.type as ItemType) || 'album';
  const title = String(params.title);
  const artist = String(params.artist);
  const artUrl = params.artUrl || undefined;

  const existing = ratingFor(id);
  const itemLike = useLikeSummary('item', id);
  const { comments, loading, error, addComment } = useComments(id, type === 'song' ? 'song' : 'album');
  const commentLikes = useLikeSummaries('comment', comments.map((c) => c.id));
  const [body, setBody] = useState('');
  const [posting, setPosting] = useState(false);
  const [scope, setScope] = useState<CommentScope>('everyone');
  const [sort, setSort] = useState<CommentSort>('newest');
  const visibleComments = filterSortComments(comments, { scope, sort });

  function rate() {
    router.push({
      pathname: '/log',
      params: { id, type, title, artist, artUrl: artUrl ?? '', year: '' },
    });
  }

  function toggleLike() {
    haptics.selection();
    itemLike.toggle();
  }

  async function post() {
    const text = body.trim();
    if (!text || !user || posting) return;
    setPosting(true);
    try {
      await addComment({
        itemTitle: title,
        itemArtist: artist,
        itemArtUrl: artUrl,
        userId: user.id,
        displayName: user.displayName,
        body: text,
      });
      setBody('');
    } finally {
      setPosting(false);
    }
  }

  return (
    <ThemedView style={styles.screen}>
      <View style={styles.topBar}>
        <Pressable onPress={() => router.back()} accessibilityLabel="Back" hitSlop={8}>
          <Ionicons name="chevron-back" size={26} color={theme.text} />
        </Pressable>
        <ThemedText type="smallBold">{type === 'song' ? 'Song' : 'Album'}</ThemedText>
        <View style={{ width: 26 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <AlbumCover uri={artUrl} size={140} radius={12} />
          <ThemedText type="subtitle" style={styles.center}>
            {title}
          </ThemedText>
          <ThemedText themeColor="textSecondary" style={styles.center}>
            {artist}
          </ThemedText>

          {existing ? (
            <View style={styles.scorePill}>
              <ThemedText type="smallBold" style={{ color: '#fff' }}>
                {existing.score.toFixed(1)}
              </ThemedText>
            </View>
          ) : null}

          <View style={styles.actionsRow}>
            <Pressable
              onPress={rate}
              style={({ pressed }) => [styles.primary, { opacity: pressed ? 0.7 : 1 }]}>
              <ThemedText type="smallBold" style={{ color: '#fff' }}>
                {existing ? 'Update rating' : 'Rate'}
              </ThemedText>
            </Pressable>

            <Pressable
              testID="like-item"
              onPress={toggleLike}
              style={({ pressed }) => [
                styles.likeBtn,
                { backgroundColor: theme.backgroundElement, opacity: pressed ? 0.6 : 1 },
              ]}>
              <Ionicons
                name={itemLike.likedByMe ? 'heart' : 'heart-outline'}
                size={18}
                color={itemLike.likedByMe ? '#E24B4A' : theme.textSecondary}
              />
              <ThemedText type="smallBold" themeColor="textSecondary">
                {itemLike.count}
              </ThemedText>
            </Pressable>
          </View>
        </View>

        <ThemedText type="smallBold" themeColor="textSecondary" style={styles.sectionLabel}>
          SCORES
        </ThemedText>
        <ScoreBreakdown itemId={id} yourScore={existing?.score} />

        <ThemedText type="smallBold" themeColor="textSecondary" style={styles.sectionLabel}>
          COMMENTS
        </ThemedText>

        <View style={styles.commentBox}>
          <TextField
            label="Add a comment"
            value={body}
            onChangeText={setBody}
            placeholder="Share your thoughts"
            multiline
            maxLength={1000}
            style={styles.commentInput}
          />
          <Pressable
            testID="post-comment"
            onPress={post}
            disabled={!body.trim() || posting}
            style={({ pressed }) => [
              styles.primary,
              { opacity: pressed || !body.trim() || posting ? 0.6 : 1 },
            ]}>
            <ThemedText type="smallBold" style={{ color: '#fff' }}>
              Post
            </ThemedText>
          </Pressable>
        </View>

        {error && (
          <ThemedText type="small" style={styles.error}>
            {error}
          </ThemedText>
        )}

        {comments.length > 1 && (
          <View style={styles.commentControls}>
            <Segmented
              options={[
                { key: 'everyone', label: 'Everyone' },
                { key: 'friends', label: 'Friends' },
              ]}
              value={scope}
              onChange={(v) => setScope(v as CommentScope)}
              testIDPrefix="comment-scope"
              style={{ flex: 1 }}
            />
            <Pressable
              testID="comment-sort"
              onPress={() => setSort((s) => (s === 'newest' ? 'oldest' : 'newest'))}
              style={({ pressed }) => [
                styles.sortBtn,
                { backgroundColor: theme.backgroundElement, opacity: pressed ? 0.6 : 1 },
              ]}>
              <Ionicons name="swap-vertical" size={15} color={theme.textSecondary} />
              <ThemedText type="small" themeColor="textSecondary">
                {sort === 'newest' ? 'Newest' : 'Oldest'}
              </ThemedText>
            </Pressable>
          </View>
        )}

        {!loading && !error && comments.length === 0 && (
          <EmptyState icon="chatbubble-outline" message="No comments yet." />
        )}

        {!loading && !error && comments.length > 0 && visibleComments.length === 0 && (
          <EmptyState icon="people-outline" message="No comments from friends yet." />
        )}

        {visibleComments.map((c) => (
          <CommentCard
            key={c.id}
            comment={c}
            likeSummary={commentLikes.summaries.get(c.id)}
            onToggleLike={() => commentLikes.toggle(c.id)}
          />
        ))}
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing.three,
  },
  content: { padding: Spacing.three, gap: Spacing.three },
  header: { alignItems: 'center', gap: Spacing.two },
  center: { textAlign: 'center' },
  scorePill: {
    backgroundColor: '#1D9E75',
    borderRadius: 999,
    minWidth: 48,
    paddingHorizontal: Spacing.three,
    paddingVertical: 4,
    alignItems: 'center',
  },
  actionsRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, marginTop: Spacing.one },
  primary: {
    backgroundColor: '#1D9E75',
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.four,
    borderRadius: 12,
  },
  likeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
    borderRadius: 12,
  },
  sectionLabel: { marginTop: Spacing.two },
  commentControls: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  sortBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
    borderRadius: 10,
  },
  commentBox: { gap: Spacing.two, alignItems: 'flex-start' },
  commentInput: { minHeight: 70, textAlignVertical: 'top', alignSelf: 'stretch' },
  error: { color: '#E24B4A' },
});
