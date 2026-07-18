/**
 * Notifications screen (ROADMAP Phase 2). Lists the derived activity that's
 * about you — new followers, comments on music you've rated, and concert tags —
 * newest first. Opening it refreshes and marks everything seen (clears the
 * badge). Comment rows open the item page.
 */

import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { EmptyState } from '@/components/empty-state';
import { PageContainer } from '@/components/page-container';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { relativeTime } from '@/feed/time';
import { useTheme } from '@/hooks/use-theme';
import { useNotifications } from '@/notifications/store';
import { initialsOf } from '@/social/feed-rows';
import type { AppNotification, NotificationKind } from '@/notifications/types';

const ICON: Record<NotificationKind, keyof typeof Ionicons.glyphMap> = {
  follow: 'person-add',
  comment: 'chatbubble',
  tag: 'mic',
  twin: 'sparkles',
};

export default function NotificationsScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { notifications, loading, refresh, markAllSeen } = useNotifications();

  // Refresh + clear the badge each time the screen opens.
  useEffect(() => {
    refresh();
    markAllSeen();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function open(n: AppNotification) {
    if ((n.kind === 'comment' || n.kind === 'twin') && n.itemId && n.itemType) {
      router.push({
        pathname: '/item/[id]',
        params: { id: n.itemId, type: n.itemType, title: n.subject ?? '', artist: '' },
      });
    }
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
        <ThemedText type="smallBold">Notifications</ThemedText>
        <View style={{ width: 26 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <PageContainer style={styles.inner}>
          {loading && notifications.length === 0 && (
            <ActivityIndicator color={theme.accent} style={{ marginTop: Spacing.four }} />
          )}

          {!loading && notifications.length === 0 && (
            <EmptyState
              icon="notifications-outline"
              message="No notifications yet. Follows, comments on your music, concert tags, and your taste twin's latest raves show up here."
            />
          )}

          {notifications.map((n) => {
            const pressable = (n.kind === 'comment' || n.kind === 'twin') && !!n.itemId;
            return (
              <Pressable
                key={n.id}
                testID={`notif-${n.id}`}
                onPress={() => open(n)}
                disabled={!pressable}
                style={({ pressed }) => [
                  styles.row,
                  { backgroundColor: theme.backgroundElement, opacity: pressed && pressable ? 0.7 : 1 },
                ]}>
                <View style={[styles.avatar, { backgroundColor: theme.backgroundSelected }]}>
                  <ThemedText type="smallBold">{initialsOf(n.actorName)}</ThemedText>
                </View>
                <View style={{ flex: 1 }}>
                  <ThemedText type="small">
                    <ThemedText type="smallBold">{n.actorName}</ThemedText> {verb(n)}
                    {n.subject ? <ThemedText type="smallBold"> {n.subject}</ThemedText> : null}
                  </ThemedText>
                  {n.excerpt ? (
                    <ThemedText type="small" themeColor="textSecondary" numberOfLines={2} style={styles.excerpt}>
                      {/* Only a comment excerpt is a quote; twin context isn't. */}
                      {n.kind === 'comment' ? `“${n.excerpt}”` : n.excerpt}
                    </ThemedText>
                  ) : null}
                </View>
                <Ionicons name={ICON[n.kind]} size={16} color={theme.accent} />
                <ThemedText type="small" themeColor="textSecondary">
                  {relativeTime(n.createdAt)}
                </ThemedText>
              </Pressable>
            );
          })}
        </PageContainer>
      </ScrollView>
    </ThemedView>
  );
}

function verb(n: AppNotification): string {
  switch (n.kind) {
    case 'follow':
      return 'followed you';
    case 'comment':
      return 'commented on';
    case 'tag':
      return 'tagged you at';
    case 'twin':
      return 'rated';
  }
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
  inner: { gap: Spacing.two },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    padding: Spacing.three,
    borderRadius: 12,
  },
  avatar: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  excerpt: { fontStyle: 'italic', marginTop: 2 },
});
