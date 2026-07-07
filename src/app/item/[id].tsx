import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { useAuth } from '@/auth/store';
import { AlbumCover } from '@/components/album-cover';
import { CommentCard } from '@/components/comment-card';
import { EmptyState } from '@/components/empty-state';
import { PageContainer } from '@/components/page-container';
import { ScoreBreakdown } from '@/components/score-breakdown';
import { Segmented } from '@/components/segmented';
import { TextField } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { filterSortComments, useComments, type CommentScope, type CommentSort } from '@/comments';
import { Spacing } from '@/constants/theme';
import { ratingsBackend } from '@/data/ratings-provider';
import { useRatings } from '@/data/store';
import { useGoBack } from '@/hooks/use-go-back';
import { useHaptics } from '@/hooks/use-haptics';
import { useTheme } from '@/hooks/use-theme';
import { useLikeSummaries, useLikeSummary } from '@/likes';
import { musicCatalog, MusicCatalogError, type AlbumTrack } from '@/music';
import type { ItemType } from '@/ranking/types';
import { initialsOf } from '@/social/feed-rows';
import { useSocial } from '@/social/store';

export default function ItemProfileScreen() {
  const theme = useTheme();
  const router = useRouter();
  const goBack = useGoBack();
  const haptics = useHaptics();
  const { user } = useAuth();
  const { ranked, ratingFor } = useRatings();
  const { followingIds, people } = useSocial();
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
  // Where this sits in the viewer's own ranked list for this type — the
  // personal context that ties the public page to their library.
  const typeRanked = ranked.filter((r) => r.item.type === type);
  const myRank = existing ? typeRanked.findIndex((r) => r.item.id === id) + 1 : 0;
  const typeLabel = type === 'song' ? 'songs' : type === 'artist' ? 'artists' : 'albums';
  const itemLike = useLikeSummary('item', id);
  const { comments, loading, error, addComment } = useComments(id, type === 'song' ? 'song' : 'album');
  const commentLikes = useLikeSummaries('comment', comments.map((c) => c.id));
  const [body, setBody] = useState('');
  const [posting, setPosting] = useState(false);
  const [scope, setScope] = useState<CommentScope>('everyone');
  const [sort, setSort] = useState<CommentSort>('newest');
  const visibleComments = filterSortComments(comments, { scope, sort });

  // Real social proof: which people you follow have rated this item, and how
  // (blueprint §2.C). Loaded from their stored lists — no seed fallback, so
  // only actual ratings count.
  // Store ids + scores only; names resolve at render time so a late-loading
  // directory doesn't freeze them to a placeholder.
  const [friendRatings, setFriendRatings] = useState<{ userId: string; score: number }[]>([]);
  const nameOf = (uid: string) => people.find((p) => p.userId === uid)?.displayName ?? 'Someone';
  const followKey = [...followingIds].sort().join(',');
  useEffect(() => {
    const ids = [...followingIds];
    if (ids.length === 0) {
      setFriendRatings([]);
      return;
    }
    let cancelled = false;
    Promise.all(
      ids.map((uid) =>
        ratingsBackend
          .load(uid)
          .then((s) => {
            const r = (s?.list ?? []).find((x) => x.item.id === id);
            return r ? { userId: uid, score: r.score } : null;
          })
          .catch(() => null),
      ),
    ).then((results) => {
      if (cancelled) return;
      setFriendRatings(
        results
          .filter((r): r is { userId: string; score: number } => r !== null)
          .sort((a, b) => b.score - a.score),
      );
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, followKey]);

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
      .getAlbumTracks(id, { signal: controller.signal })
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
    router.push({
      pathname: '/log',
      params: {
        id: track.id,
        type: 'song',
        title: track.title,
        artist: track.artist || artist,
        year: '',
        artUrl: artUrl ?? '',
      },
    });
  }

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
        <Pressable onPress={() => goBack()} accessibilityLabel="Back" hitSlop={8}>
          <Ionicons name="chevron-back" size={26} color={theme.text} />
        </Pressable>
        <ThemedText type="smallBold">{type === 'song' ? 'Song' : 'Album'}</ThemedText>
        <View style={{ width: 26 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <PageContainer style={styles.inner}>
          <View style={styles.header}>
            <AlbumCover uri={artUrl} size={140} radius={12} />
            <ThemedText type="subtitle" style={styles.center}>
              {title}
            </ThemedText>
            <ThemedText themeColor="textSecondary" style={styles.center}>
              {artist}
            </ThemedText>

            {existing ? (
              <>
                <View style={[styles.scorePill, { backgroundColor: theme.accent }]}>
                  <ThemedText type="smallBold" style={{ color: theme.onAccent }}>
                    {existing.score.toFixed(1)}
                  </ThemedText>
                </View>
                {myRank > 0 && (
                  <ThemedText type="small" themeColor="textSecondary">
                    Your #{myRank} of {typeRanked.length} {typeLabel}
                  </ThemedText>
                )}
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
          </View>

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

          {friendRatings.length > 0 && (
            <>
              <ThemedText type="smallBold" themeColor="textSecondary" style={styles.sectionLabel}>
                RATED BY FRIENDS
              </ThemedText>
              {friendRatings.map((f) => (
                <Pressable
                  key={f.userId}
                  testID={`friend-rating-${f.userId}`}
                  onPress={() =>
                    router.push({ pathname: '/user/[id]', params: { id: f.userId, name: nameOf(f.userId) } })
                  }
                  style={({ pressed }) => [
                    styles.friendRow,
                    { backgroundColor: theme.backgroundElement, opacity: pressed ? 0.6 : 1 },
                  ]}>
                  <View style={[styles.friendAvatar, { backgroundColor: theme.backgroundSelected }]}>
                    <ThemedText type="smallBold">{initialsOf(nameOf(f.userId))}</ThemedText>
                  </View>
                  <ThemedText type="small" style={{ flex: 1 }} numberOfLines={1}>
                    {nameOf(f.userId)}
                  </ThemedText>
                  <View style={[styles.scorePill, { backgroundColor: theme.accent }]}>
                    <ThemedText type="smallBold" style={{ color: theme.onAccent }}>
                      {f.score.toFixed(1)}
                    </ThemedText>
                  </View>
                </Pressable>
              ))}
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
                {
                  backgroundColor: theme.accent,
                  opacity: pressed || !body.trim() || posting ? 0.6 : 1,
                },
              ]}>
              <ThemedText type="smallBold" style={{ color: theme.onAccent }}>
                Post
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
  friendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    borderRadius: 12,
    padding: Spacing.two,
  },
  friendAvatar: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
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
