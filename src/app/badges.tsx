import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { ScrollView, StyleSheet, Pressable, View } from 'react-native';

import { badgeInputsFromRanked, computeBadges, earnedCount, type Badge } from '@/badges/compute';
import { GuestGate } from '@/components/guest-gate';
import { PageContainer } from '@/components/page-container';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useConcerts } from '@/concerts/store';
import { useRatings } from '@/data/store';
import { useTheme } from '@/hooks/use-theme';
import { usePlaylists } from '@/playlists/store';
import { useQueue } from '@/queue/store';
import { useStreaks } from '@/streaks/store';
import { useAuth } from '@/auth/store';

/**
 * Badges (ROADMAP Phase 3): the achievement wall, derived entirely from counts
 * the stores already hold — nothing is persisted, so a badge is always exactly
 * as true as the data behind it. Reached from the Profile's Badges card.
 */
export default function BadgesScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { status } = useAuth();
  const { ranked } = useRatings();
  const { concerts } = useConcerts();
  const { longest } = useStreaks();
  const { playlists } = usePlaylists();
  const { items: queueItems } = useQueue();

  const badges = computeBadges(
    badgeInputsFromRanked(ranked, {
      concertCount: concerts.length,
      longestStreak: longest,
      listCount: playlists.length,
      queueCount: queueItems.length,
    }),
  );
  const earned = badges.filter((b) => b.earned);
  const locked = badges.filter((b) => !b.earned);

  if (status !== 'authed') {
    return (
      <GuestGate
        icon="ribbon-outline"
        title="Badges"
        message="Sign in to start earning badges for how you listen."
      />
    );
  }

  return (
    <ThemedView style={styles.screen}>
      <View style={styles.topBar}>
        <Pressable
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/profile'))}
          accessibilityLabel="Back"
          hitSlop={8}>
          <Ionicons name="chevron-back" size={26} color={theme.text} />
        </Pressable>
        <ThemedText type="smallBold">Badges</ThemedText>
        <View style={{ width: 26 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <PageContainer style={styles.inner}>
          <ThemedText type="subtitle">
            {earned.length} of {badges.length} earned
          </ThemedText>

          {earned.length > 0 && (
            <View style={styles.section}>
              <ThemedText type="smallBold" themeColor="textSecondary" style={styles.sectionLabel}>
                EARNED
              </ThemedText>
              {earned.map((b) => (
                <BadgeRow key={b.id} badge={b} />
              ))}
            </View>
          )}

          <View style={styles.section}>
            <ThemedText type="smallBold" themeColor="textSecondary" style={styles.sectionLabel}>
              {earned.length > 0 ? 'IN PROGRESS' : 'START EARNING'}
            </ThemedText>
            {locked.map((b) => (
              <BadgeRow key={b.id} badge={b} />
            ))}
          </View>
        </PageContainer>
      </ScrollView>
    </ThemedView>
  );
}

function BadgeRow({ badge }: { badge: Badge }) {
  const theme = useTheme();
  const iconName = badge.icon as keyof typeof Ionicons.glyphMap;
  return (
    <View style={[styles.row, { backgroundColor: theme.backgroundElement }]}>
      <View
        style={[
          styles.iconCircle,
          { backgroundColor: badge.earned ? theme.accent : theme.background },
        ]}>
        <Ionicons
          name={iconName}
          size={20}
          color={badge.earned ? theme.onAccent : theme.textSecondary}
        />
      </View>
      <View style={styles.rowText}>
        <ThemedText type="smallBold" themeColor={badge.earned ? 'text' : 'textSecondary'}>
          {badge.title}
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {badge.blurb}
        </ThemedText>
      </View>
      {badge.earned ? (
        <Ionicons name="checkmark-circle" size={22} color={theme.accent} />
      ) : (
        <ThemedText type="smallBold" themeColor="textSecondary">
          {badge.have}/{badge.need}
        </ThemedText>
      )}
    </View>
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
  section: { gap: Spacing.two },
  sectionLabel: { letterSpacing: 1 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    borderRadius: 12,
    padding: Spacing.three,
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowText: { flex: 1, gap: 2 },
});
