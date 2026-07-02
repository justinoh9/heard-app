import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { EmptyState } from '@/components/empty-state';
import { PageContainer } from '@/components/page-container';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { initialsOf } from '@/social/feed-rows';
import { useSocial } from '@/social/store';
import type { Profile } from '@/social/types';

/**
 * The people directory: everyone on Heard (this device in local mode, the
 * whole instance with Supabase), with follow/unfollow toggles. Following
 * someone puts their activity in your feed.
 */
export default function PeopleScreen() {
  const theme = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { people, followingIds, toggleFollow } = useSocial();

  return (
    <ThemedView style={[styles.screen, { paddingTop: insets.top }]}>
      <PageContainer style={styles.container}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} accessibilityLabel="Back" hitSlop={8}>
            <Ionicons name="chevron-back" size={24} color={theme.text} />
          </Pressable>
          <ThemedText type="subtitle">Find friends</ThemedText>
          <View style={{ width: 24 }} />
        </View>

        {people.length === 0 ? (
          <EmptyState
            icon="people-outline"
            message="Nobody else is here yet. Friends appear as soon as they create an account."
          />
        ) : (
          <ScrollView contentContainerStyle={styles.list}>
            {people.map((p) => (
              <PersonRow
                key={p.userId}
                person={p}
                following={followingIds.has(p.userId)}
                onToggle={() => toggleFollow(p.userId)}
                theme={theme}
              />
            ))}
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
  theme,
}: {
  person: Profile;
  following: boolean;
  onToggle: () => void;
  theme: ReturnType<typeof useTheme>;
}) {
  return (
    <View style={[styles.row, { backgroundColor: theme.backgroundElement }]}>
      <View style={[styles.avatar, { backgroundColor: theme.backgroundSelected }]}>
        <ThemedText type="smallBold">{initialsOf(person.displayName)}</ThemedText>
      </View>
      <ThemedText type="smallBold" style={styles.name} numberOfLines={1}>
        {person.displayName}
      </ThemedText>
      <Pressable
        testID={`follow-${person.userId}`}
        onPress={onToggle}
        accessibilityLabel={following ? `Unfollow ${person.displayName}` : `Follow ${person.displayName}`}
        style={({ pressed }) => [
          styles.followButton,
          following
            ? { backgroundColor: 'transparent', borderColor: theme.textSecondary, borderWidth: 1 }
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
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  container: { flex: 1, padding: Spacing.three, gap: Spacing.three },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  list: { gap: Spacing.two },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    borderRadius: 12,
    padding: Spacing.three,
  },
  avatar: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  name: { flex: 1 },
  followButton: {
    borderRadius: 999,
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.two,
    minWidth: 96,
    alignItems: 'center',
  },
});
