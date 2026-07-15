import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuth } from '@/auth/store';
import { useRequireAuth } from '@/auth/use-require-auth';
import { Avatar } from '@/components/avatar';
import { EmptyState } from '@/components/empty-state';
import { PageContainer } from '@/components/page-container';
import { Surface } from '@/components/surface';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useSocial } from '@/social/store';
import type { Profile } from '@/social/types';

/**
 * The people directory, with follow/unfollow toggles. Following someone puts
 * their activity in your feed.
 *
 * This screen used to render `useSocial().people`, which is every profile in the
 * instance. That's the read ROADMAP Phase 4 called out as "won't survive real
 * user counts" — and the failure isn't only speed: past a few hundred accounts,
 * scrolling a wall of strangers stops being a way to find anyone. So it searches
 * and pages through the database instead (`searchPeople`), which fixes the
 * finding problem and the fetching problem with the same move.
 */

const PAGE_SIZE = 30;
/** Long enough to not fire on every keystroke, short enough to feel live. */
const SEARCH_DEBOUNCE_MS = 250;

export default function PeopleScreen() {
  const theme = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { searchPeople, followingIds, toggleFollow } = useSocial();
  const { requireAuth } = useRequireAuth();
  const { user } = useAuth();

  const [query, setQuery] = useState('');
  const [people, setPeople] = useState<Profile[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  /**
   * Guards against out-of-order responses: type "ma", then "may", and if the
   * slower "ma" request lands last it would overwrite the newer results with
   * stale ones. Only the most recent request is allowed to win.
   */
  const requestId = useRef(0);

  const runSearch = useCallback(
    async (q: string) => {
      const id = ++requestId.current;
      setLoading(true);
      try {
        const page = await searchPeople({ query: q, limit: PAGE_SIZE, offset: 0 });
        if (id !== requestId.current) return;
        setPeople(page.profiles);
        setHasMore(page.hasMore);
      } catch (e: unknown) {
        console.warn('[people] search failed:', e);
        if (id === requestId.current) {
          setPeople([]);
          setHasMore(false);
        }
      } finally {
        if (id === requestId.current) setLoading(false);
      }
    },
    [searchPeople],
  );

  useEffect(() => {
    const t = setTimeout(() => runSearch(query), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [query, runSearch]);

  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    const id = requestId.current;
    try {
      const page = await searchPeople({ query, limit: PAGE_SIZE, offset: people.length });
      // A search that started after this page was requested has already replaced
      // the list; appending now would splice two different result sets together.
      if (id !== requestId.current) return;
      setPeople((prev) => [...prev, ...page.profiles]);
      setHasMore(page.hasMore);
    } catch (e: unknown) {
      console.warn('[people] load more failed:', e);
    } finally {
      setLoadingMore(false);
    }
  }, [loadingMore, hasMore, searchPeople, query, people.length]);

  // The directory includes the viewer; nobody needs to follow themselves.
  const rows = people.filter((p) => p.userId !== user?.id);

  return (
    <ThemedView style={[styles.screen, { paddingTop: insets.top }]}>
      <PageContainer style={styles.container}>
        <View style={styles.header}>
          <Pressable
            onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
            accessibilityLabel="Back"
            hitSlop={8}>
            <Ionicons name="chevron-back" size={24} color={theme.text} />
          </Pressable>
          <ThemedText type="subtitle">Find friends</ThemedText>
          <View style={{ width: 24 }} />
        </View>

        <View style={[styles.search, { borderColor: theme.backgroundSelected }]}>
          <Ionicons name="search" size={18} color={theme.textSecondary} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search by name or @handle"
            placeholderTextColor={theme.textSecondary}
            autoCapitalize="none"
            autoCorrect={false}
            accessibilityLabel="Search for people"
            style={[styles.searchInput, { color: theme.text }]}
          />
          {query.length > 0 ? (
            <Pressable onPress={() => setQuery('')} accessibilityLabel="Clear search" hitSlop={8}>
              <Ionicons name="close-circle" size={18} color={theme.textSecondary} />
            </Pressable>
          ) : null}
        </View>

        {loading && rows.length === 0 ? (
          <ActivityIndicator color={theme.accent} />
        ) : rows.length === 0 ? (
          <EmptyState
            icon="people-outline"
            message={
              query
                ? `Nobody matches “${query}”. Try a different name or handle.`
                : 'Nobody else is here yet. Friends appear as soon as they create an account.'
            }
          />
        ) : (
          <ScrollView contentContainerStyle={styles.list}>
            {rows.map((p) => (
              <PersonRow
                key={p.userId}
                person={p}
                following={followingIds.has(p.userId)}
                onToggle={() => requireAuth(() => toggleFollow(p.userId))}
                onOpen={() =>
                  router.push({
                    pathname: '/user/[id]',
                    params: { id: p.userId, name: p.displayName },
                  })
                }
                theme={theme}
              />
            ))}
            {hasMore ? (
              <Pressable
                onPress={loadMore}
                accessibilityRole="button"
                accessibilityLabel="Load more people"
                style={({ pressed }) => [
                  styles.loadMore,
                  { borderColor: theme.textSecondary, opacity: pressed ? 0.6 : 1 },
                ]}>
                {loadingMore ? (
                  <ActivityIndicator color={theme.accent} />
                ) : (
                  <ThemedText type="smallBold" themeColor="textSecondary">
                    Load more
                  </ThemedText>
                )}
              </Pressable>
            ) : null}
          </ScrollView>
        )}
      </PageContainer>
    </ThemedView>
  );
}

function PersonRow({
  person,
  following,
  onToggle,
  onOpen,
  theme,
}: {
  person: Profile;
  following: boolean;
  onToggle: () => void;
  onOpen: () => void;
  theme: ReturnType<typeof useTheme>;
}) {
  return (
    <Surface style={styles.row}>
      <Pressable
        testID={`person-${person.userId}`}
        onPress={onOpen}
        accessibilityLabel={`View ${person.displayName}'s profile`}
        style={({ pressed }) => [styles.personBody, { opacity: pressed ? 0.6 : 1 }]}>
        <Avatar name={person.displayName} uri={person.avatarUrl} size={40} />
        <ThemedText type="smallBold" style={styles.name} numberOfLines={1}>
          {person.displayName}
        </ThemedText>
      </Pressable>
      <Pressable
        testID={`follow-${person.userId}`}
        onPress={onToggle}
        accessibilityLabel={following ? `Unfollow ${person.displayName}` : `Follow ${person.displayName}`}
        style={({ pressed }) => [
          styles.followButton,
          following
            ? { backgroundColor: 'transparent', borderColor: theme.textSecondary, borderWidth: 1 }
            : { backgroundColor: theme.accent },
          { opacity: pressed ? 0.7 : 1 },
        ]}>
        <ThemedText
          type="smallBold"
          style={{ color: following ? theme.textSecondary : theme.onAccent }}>
          {following ? 'Following' : 'Follow'}
        </ThemedText>
      </Pressable>
    </Surface>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  container: { flex: 1, padding: Spacing.three, gap: Spacing.three },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  // `outlineStyle: 'none'` kills react-native-web's focus ring on the input,
  // which otherwise draws a square box inside the rounded pill.
  searchInput: { flex: 1, fontSize: 15, paddingVertical: 2, outlineStyle: 'none' } as object,
  list: { gap: Spacing.two },
  loadMore: {
    borderWidth: 1,
    borderRadius: 999,
    paddingVertical: Spacing.three,
    alignItems: 'center',
    marginTop: Spacing.two,
  },
  row: { flexDirection: 'row', alignItems: 'center' },
  personBody: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  name: { flex: 1 },
  followButton: {
    borderRadius: 999,
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.two,
    minWidth: 96,
    alignItems: 'center',
  },
});
