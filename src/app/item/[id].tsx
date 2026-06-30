import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { useAuth } from '@/auth/store';
import { AlbumCover } from '@/components/album-cover';
import { CommentCard } from '@/components/comment-card';
import { EmptyState } from '@/components/empty-state';
import { TextField } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useComments } from '@/comments';
import { Spacing } from '@/constants/theme';
import { useRatings } from '@/data/store';
import { useTheme } from '@/hooks/use-theme';
import type { ItemType } from '@/ranking/types';

export default function ItemProfileScreen() {
  const theme = useTheme();
  const router = useRouter();
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
  const { comments, loading, error, addComment } = useComments(id, type === 'song' ? 'song' : 'album');
  const [body, setBody] = useState('');
  const [posting, setPosting] = useState(false);

  function rate() {
    router.push({
      pathname: '/log',
      params: { id, type, title, artist, artUrl: artUrl ?? '', year: '' },
    });
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

          <Pressable
            onPress={rate}
            style={({ pressed }) => [styles.primary, { opacity: pressed ? 0.7 : 1 }]}>
            <ThemedText type="smallBold" style={{ color: '#fff' }}>
              {existing ? 'Update rating' : 'Rate'}
            </ThemedText>
          </Pressable>
        </View>

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

        {!loading && comments.length === 0 && !error && (
          <EmptyState icon="chatbubble-outline" message="No comments yet." />
        )}

        {comments.map((c) => (
          <CommentCard key={c.id} comment={c} />
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
  primary: {
    backgroundColor: '#1D9E75',
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.four,
    borderRadius: 12,
    marginTop: Spacing.one,
  },
  sectionLabel: { marginTop: Spacing.two },
  commentBox: { gap: Spacing.two, alignItems: 'flex-start' },
  commentInput: { minHeight: 70, textAlignVertical: 'top', alignSelf: 'stretch' },
  error: { color: '#E24B4A' },
});
