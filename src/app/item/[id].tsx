import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { useRequireAuth } from '@/auth/use-require-auth';
import { AlbumCover } from '@/components/album-cover';
import { BreadRating } from '@/components/bread-rating';
import { CommentCard } from '@/components/comment-card';
import { EmptyState } from '@/components/empty-state';
import { PageContainer } from '@/components/page-container';
import { PreviewButton } from '@/components/preview-button';
import { QueueButton } from '@/components/queue-button';
import { ScoreBreakdown } from '@/components/score-breakdown';
import { Segmented } from '@/components/segmented';
import { Surface } from '@/components/surface';
import { TextField } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import {
  buildThreads,
  useComments,
  type Comment,
  type CommentScope,
  type CommentSort,
} from '@/comments';
import { Spacing } from '@/constants/theme';
import { useRatings } from '@/data/store';
import { useHaptics } from '@/hooks/use-haptics';
import { useTheme } from '@/hooks/use-theme';
import { useLikeSummaries, useLikeSummary } from '@/likes';
import { musicCatalog, MusicCatalogError, type AlbumTrack } from '@/music';
import type { ItemType } from '@/ranking/types';
import { useSocial } from '@/social/store';

export default function ItemProfileScreen() {
  const theme = useTheme();
  const router = useRouter();
  const haptics = useHaptics();
  const { user, requireAuth } = useRequireAuth();
  const { ratingFor } = useRatings();
  const { people, followingIds } = useSocial();
  const params = useLocalSearchParams<{
    id: string;
    type?: string;
    title: string;
    artist: string;
    artUrl?: string;
    year?: string;
    genre?: string;
    previewUrl?: string;
  }>();

  const id = String(params.id);
  const type: ItemType = (params.type as ItemType) || 'album';
  const title = String(params.title);
  const artist = String(params.artist);
  const artUrl = params.artUrl || undefined;
  const year = params.year || '';
  const genre = params.genre || '';
  const previewUrl = params.previewUrl || undefined;

  const existing = ratingFor(id);
  const itemLike = useLikeSummary('item', id);
  const { comments, loading, error, addComment, removeComment } = useComments(
    id,
    type === 'song' ? 'song' : 'album',
  );
  const commentLikes = useLikeSummaries('comment', comments.map((c) => c.id));
  const [body, setBody] = useState('');
  const [posting, setPosting] = useState(false);
  const [scope, setScope] = useState<CommentScope>('everyone');
  const [sort, setSort] = useState<CommentSort>('newest');
  // The comment being replied to (null = posting a new top-level comment).
  const [replyTo, setReplyTo] = useState<Comment | null>(null);
  // "Friends" = the real follow graph: lowercased display names of followed users.
  const friendNames = useMemo(
    () =>
      new Set(
        people
          .filter((p) => followingIds.has(p.userId))
          .map((p) => p.displayName.trim().toLowerCase()),
      ),
    [people, followingIds],
  );
  const threads = buildThreads(comments, { scope, sort, friends: friendNames });

  // Album tracklist (songs). Only albums have one; songs skip the fetch.
  const [tracks, setTracks] = useState<AlbumTrack[]>([]);
  const [tracksLoading, setTracksLoading] = useState(type === 'album');
  const [tracksError, setTracksError] = useState<string | null>(null);

  useEffect(() => {
    if (type !== 'album') return;
    const controller = new AbortController();
    setTracksLoading(true);
    setTracksError(null);
    musicCatalog
      .getAlbumTracks(id, { signal: controller.signal, title, artist })
      .then((t) => {
        setTracks(t);
        setTracksLoading(false);
      })
      .catch((e: unknown) => {
        if ((e as Error)?.name === 'AbortError') return;
        setTracksError(e instanceof MusicCatalogError ? e.message : 'Could not load tracks.');
        setTracksLoading(false);
      });
    return () => controller.abort();
  }, [id, type]);

  function openTrack(track: AlbumTrack) {
    // Open the track's own profile page (browsable), not the rate flow.
    router.push({
      pathname: '/item/[id]',
      params: {
        id: track.id,
        type: 'song',
        title: track.title,
        artist: track.artist || artist,
        artUrl: artUrl ?? '',
        previewUrl: track.previewUrl ?? '',
      },
    });
  }

  function rate() {
    requireAuth(() =>
      router.push({
        pathname: '/log',
        params: { id, type, title, artist, artUrl: artUrl ?? '', year, genre },
      }),
    );
  }

  function toggleLike() {
    requireAuth(() => {
      haptics.selection();
      itemLike.toggle();
    });
  }

  async function post() {
    const text = body.trim();
    if (!text || posting) return;
    if (!user) {
      router.push('/(auth)/sign-in');
      return;
    }
    setPosting(true);
    try {
      await addComment({
        itemTitle: title,
        itemArtist: artist,
        itemArtUrl: artUrl,
        userId: user.id,
        displayName: user.displayName,
        body: text,
        // Replies to a reply still thread under the top-level comment (one
        // level deep), so anchor to the parent's root, not the reply itself.
        parentId: replyTo?.parentId ?? replyTo?.id,
      });
      setBody('');
      setReplyTo(null);
    } finally {
      setPosting(false);
    }
  }

  function startReply(comment: Comment) {
    requireAuth(() => setReplyTo(comment));
  }

  /** Delete callback for a comment, only when it belongs to the viewer. */
  function deleteHandler(comment: Comment): (() => void) | undefined {
    if (!user || comment.userId !== user.id) return undefined;
    return () =>
      removeComment(comment.id, user.id).catch((e: unknown) =>
        console.warn('Failed to delete comment', e),
      );
  }

  return (
    <ThemedView style={styles.screen}>
      <View style={styles.topBar}>
        <Pressable
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
          accessibilityLabel="Back"
          hitSlop={8}>
          <Ionicons name="chevron-back" size={26} color={theme.text} />
        </Pressable>
        <ThemedText type="smallBold">{type === 'song' ? 'Song' : 'Album'}</ThemedText>
        <View style={{ width: 26 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <PageContainer style={styles.inner}>
          <Surface style={styles.header}>
            <AlbumCover uri={artUrl} size={140} radius={12} />
            <ThemedText type="subtitle" style={styles.center}>
              {title}
            </ThemedText>
            <View style={styles.artistRow}>
              <ThemedText themeColor="textSecondary" style={styles.center}>
                {artist}
              </ThemedText>
              {previewUrl ? <PreviewButton url={previewUrl} size={26} /> : null}
            </View>

            {existing ? (
              <>
                <BreadRating score={existing.score} size={26} />
                <View style={[styles.scorePill, { backgroundColor: theme.accent }]}>
                  <ThemedText type="smallBold" style={{ color: theme.onAccent }}>
                    {existing.score.toFixed(1)}
                  </ThemedText>
                </View>
              </>
            ) : null}

            <View style={styles.actionsRow}>
              <Pressable
                onPress={rate}
                style={({ pressed }) => [
                  styles.primary,
                  { backgroundColor: theme.accent, opacity: pressed ? 0.7 : 1 },
                ]}>
                <ThemedText type="smallBold" style={{ color: theme.onAccent }}>
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
                  color={itemLike.likedByMe ? theme.accent : theme.textSecondary}
                />
                <ThemedText type="smallBold" themeColor="textSecondary">
                  {itemLike.count}
                </ThemedText>
              </Pressable>
            </View>

            <QueueButton
              target={{ itemId: id, type, title, artist, artUrl }}
              variant="button"
            />
          </Surface>

          {type === 'album' && (
            <>
              <ThemedText type="smallBold" themeColor="textSecondary" style={styles.sectionLabel}>
                TRACKS
              </ThemedText>
              {tracksLoading && <ActivityIndicator style={{ marginTop: Spacing.two }} />}
              {tracksError && (
                <ThemedText type="small" style={[styles.error, { color: theme.danger }]}>
                  {tracksError}
                </ThemedText>
              )}
              {!tracksLoading &&
                !tracksError &&
                tracks.map((track) => {
                  const rated = ratingFor(track.id);
                  return (
                    <Pressable
                      key={track.id}
                      testID="album-track"
                      onPress={() => openTrack(track)}
                      style={({ pressed }) => [styles.trackRow, { opacity: pressed ? 0.6 : 1 }]}>
                      <ThemedText type="small" themeColor="textSecondary" style={styles.trackNum}>
                        {track.trackNumber}
                      </ThemedText>
                      <ThemedText type="small" numberOfLines={1} style={styles.trackTitle}>
                        {track.title}
                      </ThemedText>
                      <PreviewButton url={track.previewUrl} size={20} />
                      {rated ? (
                        <View style={[styles.trackScore, { backgroundColor: theme.accent }]}>
                          <ThemedText
                            type="small"
                            style={{ color: theme.onAccent, fontWeight: '700' }}>
                            {rated.score.toFixed(1)}
                          </ThemedText>
                        </View>
                      ) : (
                        <ThemedText type="small" themeColor="textSecondary">
                          {formatDuration(track.durationMs)}
                        </ThemedText>
                      )}
                    </Pressable>
                  );
                })}
            </>
          )}

          <ThemedText type="smallBold" themeColor="textSecondary" style={styles.sectionLabel}>
            SCORES
          </ThemedText>
          <ScoreBreakdown itemId={id} yourScore={existing?.score} />

          <ThemedText type="smallBold" themeColor="textSecondary" style={styles.sectionLabel}>
            COMMENTS
          </ThemedText>

          <View style={styles.commentBox}>
            {replyTo && (
              <View style={[styles.replyBanner, { backgroundColor: theme.backgroundElement }]}>
                <Ionicons name="arrow-undo" size={14} color={theme.accent} />
                <ThemedText type="small" themeColor="textSecondary" style={{ flex: 1 }} numberOfLines={1}>
                  Replying to {replyTo.displayName}
                </ThemedText>
                <Pressable
                  testID="cancel-reply"
                  onPress={() => setReplyTo(null)}
                  accessibilityLabel="Cancel reply"
                  hitSlop={8}>
                  <Ionicons name="close" size={16} color={theme.textSecondary} />
                </Pressable>
              </View>
            )}
            <TextField
              label={replyTo ? 'Add a reply' : 'Add a comment'}
              value={body}
              onChangeText={setBody}
              placeholder={replyTo ? `Reply to ${replyTo.displayName}` : 'Share your thoughts'}
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
                {
                  backgroundColor: theme.accent,
                  opacity: pressed || !body.trim() || posting ? 0.6 : 1,
                },
              ]}>
              <ThemedText type="smallBold" style={{ color: theme.onAccent }}>
                {replyTo ? 'Reply' : 'Post'}
              </ThemedText>
            </Pressable>
          </View>

          {error && (
            <ThemedText type="small" style={[styles.error, { color: theme.danger }]}>
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

          {!loading && !error && comments.length > 0 && threads.length === 0 && (
            <EmptyState icon="people-outline" message="No comments from friends yet." />
          )}

          {threads.map((thread) => (
            <View key={thread.comment.id} style={styles.thread}>
              <CommentCard
                comment={thread.comment}
                likeSummary={commentLikes.summaries.get(thread.comment.id)}
                onToggleLike={() => commentLikes.toggle(thread.comment.id)}
                onReply={() => startReply(thread.comment)}
                onDelete={deleteHandler(thread.comment)}
              />
              {thread.replies.length > 0 && (
                <View style={[styles.replies, { borderColor: theme.backgroundElement }]}>
                  {thread.replies.map((reply) => (
                    <CommentCard
                      key={reply.id}
                      comment={reply}
                      likeSummary={commentLikes.summaries.get(reply.id)}
                      onToggleLike={() => commentLikes.toggle(reply.id)}
                      onReply={() => startReply(reply)}
                      onDelete={deleteHandler(reply)}
                    />
                  ))}
                </View>
              )}
            </View>
          ))}
        </PageContainer>
      </ScrollView>
    </ThemedView>
  );
}

/** ms → "m:ss". */
function formatDuration(ms: number): string {
  const total = Math.round(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing.three,
  },
  content: { padding: Spacing.three },
  inner: { gap: Spacing.three },
  header: { alignItems: 'center', gap: Spacing.two },
  artistRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.one },
  center: { textAlign: 'center' },
  scorePill: {
    borderRadius: 999,
    minWidth: 48,
    paddingHorizontal: Spacing.three,
    paddingVertical: 4,
    alignItems: 'center',
  },
  actionsRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, marginTop: Spacing.one },
  primary: {
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
  replyBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    alignSelf: 'stretch',
    borderRadius: 8,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  thread: { gap: Spacing.two },
  // Replies sit indented under their parent with a hairline rail on the left.
  replies: { marginLeft: Spacing.four, borderLeftWidth: 2, paddingLeft: Spacing.two, gap: Spacing.two },
  error: {},
  trackRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingVertical: Spacing.two,
  },
  trackNum: { minWidth: 20, textAlign: 'center' },
  trackTitle: { flex: 1 },
  trackScore: {
    borderRadius: 999,
    minWidth: 34,
    paddingHorizontal: Spacing.two,
    paddingVertical: 2,
    alignItems: 'center',
  },
});
