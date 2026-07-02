import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AlbumCover } from '@/components/album-cover';
import { PageContainer } from '@/components/page-container';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { INITIAL_RANKED } from '@/data/catalog';
import { ratingsBackend } from '@/data/ratings-provider';
import { useRatings } from '@/data/store';
import { relativeTime } from '@/feed/time';
import { useTheme } from '@/hooks/use-theme';
import { sortRanked } from '@/ranking/engine';
import type { RankedItem } from '@/ranking/types';
import { compatibility, type Compatibility } from '@/social/compatibility';
import { initialsOf } from '@/social/feed-rows';
import { socialBackend } from '@/social/provider';
import { useSocial } from '@/social/store';
import type { SocialEvent } from '@/social/types';

const TOP_COUNT = 5;

/**
 * Another user's public profile: the taste-compatibility banner
 * (PRODUCT_BLUEPRINT §2.C — "84% match" + the shared favorites driving it),
 * their top-ranked list, and their recent activity. Reached from the People
 * directory and from feed-card avatars.
 */
export default function UserProfileScreen() {
  const theme = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ id: string; name?: string }>();
  const userId = String(params.id);
  const displayName = params.name || 'Someone';
  const { ranked: mine } = useRatings();
  const { followingIds, toggleFollow } = useSocial();

  const [theirs, setTheirs] = useState<RankedItem[] | null>(null);
  const [activity, setActivity] = useState<SocialEvent[]>([]);

  useEffect(() => {
    let cancelled = false;
    // Their visible list: stored ratings, or the demo seed they also see
    // locally before their first commit — keeps the % honest to their screen.
    ratingsBackend
      .load(userId)
      .then((stored) => {
        if (!cancelled) setTheirs(sortRanked(stored?.list ?? INITIAL_RANKED));
      })
      .catch(() => {
        if (!cancelled) setTheirs([]);
      });
    socialBackend
      .feedFor([userId], 10)
      .then((events) => {
        if (!cancelled) setActivity(events);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const following = followingIds.has(userId);
  const compat: Compatibility | null = theirs ? compatibility(mine, theirs) : null;

  return (
    <ThemedView style={[styles.screen, { paddingTop: insets.top }]}>
      <ScrollView>
        <PageContainer style={styles.container}>
          <View style={styles.header}>
            <Pressable onPress={() => router.back()} accessibilityLabel="Back" hitSlop={8}>
              <Ionicons name="chevron-back" size={24} color={theme.text} />
            </Pressable>
            <ThemedText type="subtitle">{displayName}</ThemedText>
            <View style={{ width: 24 }} />
          </View>

          <View style={styles.identity}>
            <View style={[styles.avatar, { backgroundColor: theme.backgroundElement }]}>
              <ThemedText type="title">{initialsOf(displayName)}</ThemedText>
            </View>
            <Pressable
              testID="profile-follow"
              onPress={() => toggleFollow(userId)}
              accessibilityLabel={following ? `Unfollow ${displayName}` : `Follow ${displayName}`}
              style={({ pressed }) => [
                styles.followButton,
                following
                  ? { borderColor: theme.textSecondary, borderWidth: 1 }
                  : { backgroundColor: '#1D9E75' },
                { opacity: pressed ? 0.7 : 1 },
              ]}>
              <ThemedText
                type="smallBold"
                style={{ color: following ? theme.textSecondary : '#fff' }}>
                {following ? 'Following' : 'Follow'}
              </ThemedText>
            </Pressable>
          </View>

          {!compat ? (
            <View style={styles.center}>
              <ActivityIndicator />
            </View>
          ) : (
            <>
              <View style={[styles.matchCard, { backgroundColor: theme.backgroundElement }]}>
                <View style={styles.matchHeader}>
                  <ThemedText style={styles.matchPercent}>{compat.percent}%</ThemedText>
                  <View style={{ flex: 1 }}>
                    <ThemedText type="smallBold">taste match</ThemedText>
                    <ThemedText type="small" themeColor="textSecondary">
                      {compat.overlapCount > 0
                        ? `Based on ${compat.overlapCount} shared ${compat.overlapCount === 1 ? 'album' : 'albums'}`
                        : 'Nothing in common yet — rate more music'}
                    </ThemedText>
                  </View>
                </View>
                {compat.sharedFavorites.length > 0 && (
                  <>
                    <ThemedText type="small" themeColor="textSecondary">
                      You both love
                    </ThemedText>
                    <View style={styles.favoritesRow}>
                      {compat.sharedFavorites.map((item) => (
                        <View key={item.id} style={styles.favorite}>
                          <AlbumCover uri={item.artUrl} size={72} radius={8} />
                          <ThemedText type="small" numberOfLines={1} style={styles.favoriteTitle}>
                            {item.title}
                          </ThemedText>
                        </View>
                      ))}
                    </View>
                  </>
                )}
              </View>

              {theirs && theirs.length > 0 && (
                <>
                  <ThemedText type="subtitle" style={styles.sectionHeader}>
                    Their top albums
                  </ThemedText>
                  {theirs.slice(0, TOP_COUNT).map((r, i) => (
                    <View key={r.item.id} style={styles.rankRow}>
                      <ThemedText type="smallBold" themeColor="textSecondary" style={styles.rankNum}>
                        {i + 1}
                      </ThemedText>
                      <AlbumCover uri={r.item.artUrl} size={44} radius={6} />
                      <View style={{ flex: 1 }}>
                        <ThemedText type="smallBold" numberOfLines={1}>
                          {r.item.title}
                        </ThemedText>
                        <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
                          {r.item.artist}
                        </ThemedText>
                      </View>
                      <View style={styles.scorePill}>
                        <ThemedText type="smallBold" style={{ color: '#fff' }}>
                          {r.score.toFixed(1)}
                        </ThemedText>
                      </View>
                    </View>
                  ))}
                </>
              )}

              {activity.length > 0 && (
                <>
                  <ThemedText type="subtitle" style={styles.sectionHeader}>
                    Recent activity
                  </ThemedText>
                  {activity.map((e) => (
                    <View key={e.id} style={styles.activityRow}>
                      <Ionicons
                        name={e.type === 'drop' ? 'radio' : 'star'}
                        size={14}
                        color={theme.textSecondary}
                      />
                      <ThemedText type="small" style={{ flex: 1 }} numberOfLines={1}>
                        {e.type === 'drop' ? 'shared ' : 'rated '}
                        <ThemedText type="smallBold">{e.payload.title}</ThemedText>
                        {e.type === 'rated' && e.payload.score != null
                          ? ` · ${e.payload.score.toFixed(1)}`
                          : ''}
                      </ThemedText>
                      <ThemedText type="small" themeColor="textSecondary">
                        {relativeTime(e.createdAt)}
                      </ThemedText>
                    </View>
                  ))}
                </>
              )}
            </>
          )}
        </PageContainer>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  container: { padding: Spacing.three, gap: Spacing.three },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  identity: { alignItems: 'center', gap: Spacing.three },
  avatar: { width: 84, height: 84, borderRadius: 42, alignItems: 'center', justifyContent: 'center' },
  followButton: {
    borderRadius: 999,
    paddingHorizontal: Spacing.five,
    paddingVertical: Spacing.two,
    minWidth: 120,
    alignItems: 'center',
  },
  center: { paddingVertical: Spacing.six, alignItems: 'center' },
  matchCard: { borderRadius: 12, padding: Spacing.three, gap: Spacing.two },
  matchHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  matchPercent: { fontSize: 34, fontWeight: '800', color: '#1D9E75' },
  favoritesRow: { flexDirection: 'row', gap: Spacing.three },
  favorite: { width: 72 },
  favoriteTitle: { marginTop: 4 },
  sectionHeader: { marginTop: Spacing.two },
  rankRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  rankNum: { width: 18, textAlign: 'center' },
  scorePill: {
    backgroundColor: '#1D9E75',
    borderRadius: 999,
    minWidth: 40,
    paddingHorizontal: Spacing.two,
    paddingVertical: 3,
    alignItems: 'center',
  },
  activityRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
});
