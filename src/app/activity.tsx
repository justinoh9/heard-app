import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuth } from '@/auth/store';
import { EmptyState } from '@/components/empty-state';
import { PageContainer } from '@/components/page-container';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { relativeTime } from '@/feed/time';
import { useTheme } from '@/hooks/use-theme';
import { likesBackend } from '@/likes';
import { socialBackend } from '@/social/provider';
import { useSocial } from '@/social/store';
import type { SocialEvent } from '@/social/types';

/** A short "your …" phrase describing one of the viewer's own feed events. */
function eventPhrase(e: SocialEvent): string {
  const p = e.payload;
  switch (e.type) {
    case 'rated':
      return `your rating of ${p.title ?? 'an album'}`;
    case 'drop':
      return 'your daily drop';
    case 'concert':
      return p.title ? `your ${p.title} show` : 'your show';
    case 'list':
      return p.title ? `your list “${p.title}”` : 'your list';
    case 'streak':
      return 'your streak';
    default:
      return 'your activity';
  }
}

interface Reaction {
  id: string;
  actorId: string;
  phrase: string;
  createdAt: string;
}

/**
 * The Activity inbox (PRODUCT_BLUEPRINT §2.C): a daily-return hook built purely
 * from existing tables — hearts on your activity + new followers. No new
 * storage; aggregated on open. Pushed from the Profile tab.
 */
export default function ActivityScreen() {
  const theme = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const myId = user?.id ?? '';
  const { people } = useSocial();
  const nameOf = (id: string) => people.find((p) => p.userId === id)?.displayName ?? 'Someone';

  const [loading, setLoading] = useState(true);
  const [reactions, setReactions] = useState<Reaction[]>([]);
  const [followerIds, setFollowerIds] = useState<string[]>([]);

  useEffect(() => {
    if (!myId) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    (async () => {
      const [myEvents, follows] = await Promise.all([
        socialBackend.feedFor([myId], 50).catch(() => [] as SocialEvent[]),
        socialBackend.followers(myId).catch(() => [] as string[]),
      ]);
      const eventById = new Map(myEvents.map((e) => [e.id, e]));
      const actors = myEvents.length
        ? await likesBackend.likersOf('feed_event', myEvents.map((e) => e.id)).catch(() => [])
        : [];
      if (cancelled) return;
      setReactions(
        actors
          .filter((a) => a.userId !== myId)
          .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
          .map((a, i) => ({
            id: `${a.targetId}-${a.userId}-${i}`,
            actorId: a.userId,
            phrase: eventById.get(a.targetId) ? eventPhrase(eventById.get(a.targetId)!) : 'your activity',
            createdAt: a.createdAt,
          })),
      );
      setFollowerIds(follows.filter((id) => id !== myId));
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [myId]);

  const empty = reactions.length === 0 && followerIds.length === 0;

  function openUser(id: string) {
    router.push({ pathname: '/user/[id]', params: { id, name: nameOf(id) } });
  }

  return (
    <ThemedView style={[styles.screen, { paddingTop: insets.top }]}>
      <ScrollView>
        <PageContainer style={styles.container}>
          <View style={styles.header}>
            <Pressable onPress={() => router.back()} accessibilityLabel="Back" hitSlop={8}>
              <Ionicons name="chevron-back" size={24} color={theme.text} />
            </Pressable>
            <ThemedText type="subtitle">Activity</ThemedText>
            <View style={{ width: 24 }} />
          </View>

          {loading ? (
            <View style={styles.center}>
              <ActivityIndicator />
            </View>
          ) : empty ? (
            <EmptyState
              icon="notifications-outline"
              message="No activity yet. Hearts on your posts and new followers will show up here."
            />
          ) : (
            <>
              {reactions.length > 0 && (
                <>
                  <ThemedText type="smallBold" themeColor="textSecondary" style={styles.sectionLabel}>
                    REACTIONS
                  </ThemedText>
                  {reactions.map((r) => (
                    <Row
                      key={r.id}
                      icon="heart"
                      iconColor={theme.accent}
                      onPress={() => openUser(r.actorId)}
                      theme={theme}>
                      <ThemedText type="small">
                        <ThemedText type="smallBold">{nameOf(r.actorId)}</ThemedText> liked {r.phrase}
                      </ThemedText>
                      <ThemedText type="small" themeColor="textSecondary">
                        {relativeTime(r.createdAt)}
                      </ThemedText>
                    </Row>
                  ))}
                </>
              )}

              {followerIds.length > 0 && (
                <>
                  <ThemedText type="smallBold" themeColor="textSecondary" style={styles.sectionLabel}>
                    FOLLOWERS
                  </ThemedText>
                  {followerIds.map((id) => (
                    <Row
                      key={id}
                      icon="person-add"
                      iconColor={theme.accentAlt}
                      onPress={() => openUser(id)}
                      theme={theme}>
                      <ThemedText type="small">
                        <ThemedText type="smallBold">{nameOf(id)}</ThemedText> follows you
                      </ThemedText>
                    </Row>
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

function Row({
  icon,
  iconColor,
  onPress,
  theme,
  children,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  iconColor: string;
  onPress: () => void;
  theme: ReturnType<typeof useTheme>;
  children: React.ReactNode;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        { backgroundColor: theme.backgroundElement, opacity: pressed ? 0.6 : 1 },
      ]}>
      <View style={[styles.iconCircle, { backgroundColor: theme.backgroundSelected }]}>
        <Ionicons name={icon} size={16} color={iconColor} />
      </View>
      <View style={styles.rowText}>{children}</View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  container: { padding: Spacing.three, gap: Spacing.two },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.one,
  },
  center: { paddingVertical: Spacing.six, alignItems: 'center' },
  sectionLabel: { marginTop: Spacing.three, letterSpacing: 1 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    borderRadius: 12,
    padding: Spacing.three,
  },
  iconCircle: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  rowText: { flex: 1, gap: 2 },
});
