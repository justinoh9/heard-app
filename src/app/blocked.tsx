import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { useAuth } from '@/auth/store';
import { Avatar } from '@/components/avatar';
import { EmptyState } from '@/components/empty-state';
import { GuestGate } from '@/components/guest-gate';
import { PageContainer } from '@/components/page-container';
import { Surface } from '@/components/surface';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useToast } from '@/components/toast';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useModeration } from '@/moderation/store';
import { socialBackend } from '@/social/provider';
import type { Profile } from '@/social/types';

/**
 * Blocked accounts (ROADMAP Phase 4), reached from Settings → SAFETY.
 *
 * Note this reads `socialBackend.listProfiles()` **directly** rather than
 * `useSocial().people`: the social store filters blocked users out of its
 * directory, which is exactly right everywhere else and exactly wrong here —
 * this is the one screen whose job is to show them.
 */
export default function BlockedScreen() {
  const theme = useTheme();
  const router = useRouter();
  const toast = useToast();
  const { status } = useAuth();
  const { blockedIds, unblock } = useModeration();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    socialBackend
      .listProfiles()
      .then((all) => {
        if (!cancelled) setProfiles(all);
      })
      .catch((e: unknown) => console.warn('[blocked] load failed:', e))
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (status !== 'authed') {
    return (
      <GuestGate
        icon="ban-outline"
        title="Blocked accounts"
        message="Sign in to see the accounts you've blocked."
      />
    );
  }

  // Keep unblocked rows on screen until the next visit rather than having them
  // vanish mid-tap — `blockedIds` updates optimistically, so the row's button
  // flips to "Unblocked" and stays put.
  const rows = profiles.filter((p) => blockedIds.has(p.userId));

  return (
    <ThemedView style={styles.screen}>
      <View style={styles.topBar}>
        <Pressable
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/settings'))}
          accessibilityLabel="Back"
          hitSlop={8}>
          <Ionicons name="chevron-back" size={26} color={theme.text} />
        </Pressable>
        <ThemedText type="smallBold">Blocked accounts</ThemedText>
        <View style={{ width: 26 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <PageContainer style={styles.inner}>
          {rows.length === 0 && !loading ? (
            <EmptyState
              icon="shield-checkmark-outline"
              message="You haven't blocked anyone. If someone's bothering you, open their profile and choose Block."
            />
          ) : (
            <>
              <ThemedText type="small" themeColor="textSecondary">
                Blocked people can't see your activity and won't appear anywhere in the app.
                Unblocking doesn't restore any follows that were undone.
              </ThemedText>
              {rows.map((p) => (
                <Surface key={p.userId} style={styles.row}>
                  <Avatar name={p.displayName} uri={p.avatarUrl} size={40} />
                  <View style={styles.rowText}>
                    <ThemedText type="smallBold" numberOfLines={1}>
                      {p.displayName}
                    </ThemedText>
                    {p.handle ? (
                      <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
                        @{p.handle}
                      </ThemedText>
                    ) : null}
                  </View>
                  <Pressable
                    testID={`unblock-${p.userId}`}
                    onPress={() => {
                      unblock(p.userId);
                      toast(`Unblocked ${p.displayName}`, '👋');
                    }}
                    accessibilityLabel={`Unblock ${p.displayName}`}
                    style={({ pressed }) => [
                      styles.pill,
                      { borderColor: theme.textSecondary, opacity: pressed ? 0.6 : 1 },
                    ]}>
                    <ThemedText type="smallBold" themeColor="textSecondary">
                      Unblock
                    </ThemedText>
                  </Pressable>
                </Surface>
              ))}
            </>
          )}
        </PageContainer>
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
  content: { padding: Spacing.three, paddingBottom: Spacing.six },
  inner: { gap: Spacing.three },
  row: { flexDirection: 'row', gap: Spacing.three, alignItems: 'center' },
  rowText: { flex: 1, gap: 2 },
  pill: { borderWidth: 1, borderRadius: 999, paddingHorizontal: Spacing.three, paddingVertical: 6 },
});
