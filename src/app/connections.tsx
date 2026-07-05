import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuth } from '@/auth/store';
import { EmptyState } from '@/components/empty-state';
import { PageContainer } from '@/components/page-container';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { initialsOf } from '@/social/feed-rows';
import { socialBackend } from '@/social/provider';
import { useSocial } from '@/social/store';

type Mode = 'followers' | 'following';

/**
 * Who follows / is followed by a user — the tap-through from the follower and
 * following counts on a profile. Each row has a follow toggle (reusing the
 * social store) and opens the person's profile.
 */
export default function ConnectionsScreen() {
  const theme = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ id: string; mode?: string }>();
  const ownerId = String(params.id);
  const mode: Mode = params.mode === 'followers' ? 'followers' : 'following';

  const { user } = useAuth();
  const myId = user?.id ?? '';
  const { people, followingIds, toggleFollow } = useSocial();
  const nameOf = (id: string) => people.find((p) => p.userId === id)?.displayName ?? 'Someone';

  const [ids, setIds] = useState<string[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = mode === 'followers' ? socialBackend.followers(ownerId) : socialBackend.following(ownerId);
    load
      .then((result) => {
        if (!cancelled) setIds(result);
      })
      .catch(() => {
        if (!cancelled) setIds([]);
      });
    return () => {
      cancelled = true;
    };
  }, [ownerId, mode]);

  return (
    <ThemedView style={[styles.screen, { paddingTop: insets.top }]}>
      <PageContainer style={styles.container}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} accessibilityLabel="Back" hitSlop={8}>
            <Ionicons name="chevron-back" size={24} color={theme.text} />
          </Pressable>
          <ThemedText type="subtitle">{mode === 'followers' ? 'Followers' : 'Following'}</ThemedText>
          <View style={{ width: 24 }} />
        </View>

        {ids === null ? (
          <View style={styles.center}>
            <ActivityIndicator />
          </View>
        ) : ids.length === 0 ? (
          <EmptyState
            icon="people-outline"
            message={mode === 'followers' ? 'No followers yet.' : 'Not following anyone yet.'}
          />
        ) : (
          <ScrollView contentContainerStyle={styles.list}>
            {ids.map((id) => (
              <View key={id} style={[styles.row, { backgroundColor: theme.backgroundElement }]}>
                <Pressable
                  testID={`connection-${id}`}
                  onPress={() => router.push({ pathname: '/user/[id]', params: { id, name: nameOf(id) } })}
                  accessibilityLabel={`View ${nameOf(id)}'s profile`}
                  style={({ pressed }) => [styles.personBody, { opacity: pressed ? 0.6 : 1 }]}>
                  <View style={[styles.avatar, { backgroundColor: theme.backgroundSelected }]}>
                    <ThemedText type="smallBold">{initialsOf(nameOf(id))}</ThemedText>
                  </View>
                  <ThemedText type="smallBold" numberOfLines={1} style={{ flex: 1 }}>
                    {nameOf(id)}
                  </ThemedText>
                </Pressable>
                {id !== myId && (
                  <Pressable
                    testID={`follow-${id}`}
                    onPress={() => toggleFollow(id)}
                    accessibilityLabel={
                      followingIds.has(id) ? `Unfollow ${nameOf(id)}` : `Follow ${nameOf(id)}`
                    }
                    style={({ pressed }) => [
                      styles.followButton,
                      followingIds.has(id)
                        ? { borderColor: theme.textSecondary, borderWidth: 1 }
                        : { backgroundColor: theme.accent },
                      { opacity: pressed ? 0.7 : 1 },
                    ]}>
                    <ThemedText
                      type="smallBold"
                      style={{ color: followingIds.has(id) ? theme.textSecondary : theme.onAccent }}>
                      {followingIds.has(id) ? 'Following' : 'Follow'}
                    </ThemedText>
                  </Pressable>
                )}
              </View>
            ))}
          </ScrollView>
        )}
      </PageContainer>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  container: { flex: 1, padding: Spacing.three, gap: Spacing.three },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  center: { paddingVertical: Spacing.six, alignItems: 'center' },
  list: { gap: Spacing.two },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    borderRadius: 12,
    padding: Spacing.three,
  },
  avatar: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  personBody: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  followButton: {
    borderRadius: 999,
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.two,
    minWidth: 96,
    alignItems: 'center',
  },
});
