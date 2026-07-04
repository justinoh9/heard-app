import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PageContainer } from '@/components/page-container';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import {
  computeAchievements,
  type Badge,
  type BadgeCategory,
} from '@/achievements/logic';
import { useConcerts } from '@/concerts/store';
import { Spacing } from '@/constants/theme';
import { useRatings } from '@/data/store';
import { useTheme } from '@/hooks/use-theme';
import { useStreaks } from '@/streaks/store';

const SECTION_LABEL: Record<BadgeCategory, string> = {
  ratings: 'RATINGS',
  shows: 'LIVE SHOWS',
  streak: 'STREAKS',
  decades: 'DECADES',
  artists: 'ARTISTS',
};

const ORDER: BadgeCategory[] = ['ratings', 'shows', 'streak', 'decades', 'artists'];

/**
 * Badges (PRODUCT_BLUEPRINT §2.D): tiered achievements derived from the diary,
 * concert log, and streak record. Pushed from the Profile tab. Purely a render
 * of computeAchievements — no storage of its own.
 */
export default function AchievementsScreen() {
  const theme = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { ranked } = useRatings();
  const { concerts } = useConcerts();
  const { longest } = useStreaks();

  const summary = computeAchievements({ ranked, concerts, longestStreak: longest });

  return (
    <ThemedView style={[styles.screen, { paddingTop: insets.top }]}>
      <ScrollView>
        <PageContainer style={styles.container}>
          <View style={styles.header}>
            <Pressable onPress={() => router.back()} accessibilityLabel="Back" hitSlop={8}>
              <Ionicons name="chevron-back" size={24} color={theme.text} />
            </Pressable>
            <ThemedText type="subtitle">Badges</ThemedText>
            <View style={{ width: 24 }} />
          </View>

          <ThemedText type="small" themeColor="textSecondary" style={styles.center}>
            {summary.earnedCount} of {summary.total} earned
            {summary.nextUp
              ? ` · next: ${summary.nextUp.title} (${summary.nextUp.progress}/${summary.nextUp.threshold})`
              : ' · all unlocked 🎉'}
          </ThemedText>

          {ORDER.map((category) => {
            const badges = summary.badges.filter((b) => b.category === category);
            return (
              <View key={category} style={styles.section}>
                <ThemedText type="smallBold" themeColor="textSecondary" style={styles.sectionLabel}>
                  {SECTION_LABEL[category]}
                </ThemedText>
                <View style={styles.grid}>
                  {badges.map((b) => (
                    <BadgeCard key={b.id} badge={b} theme={theme} />
                  ))}
                </View>
              </View>
            );
          })}
        </PageContainer>
      </ScrollView>
    </ThemedView>
  );
}

function BadgeCard({ badge, theme }: { badge: Badge; theme: ReturnType<typeof useTheme> }) {
  const ratio = Math.min(1, badge.progress / badge.threshold);
  return (
    <View
      testID={`badge-${badge.id}`}
      style={[
        styles.card,
        {
          backgroundColor: badge.earned ? theme.accentSoft : theme.backgroundElement,
          opacity: badge.earned ? 1 : 0.7,
        },
      ]}>
      <View
        style={[
          styles.iconCircle,
          { backgroundColor: badge.earned ? theme.accent : theme.backgroundSelected },
        ]}>
        <Ionicons
          name={badge.icon as keyof typeof Ionicons.glyphMap}
          size={22}
          color={badge.earned ? theme.onAccent : theme.textSecondary}
        />
        {badge.earned && (
          <View style={[styles.check, { backgroundColor: theme.background }]}>
            <Ionicons name="checkmark-circle" size={16} color={theme.accent} />
          </View>
        )}
      </View>

      <ThemedText type="smallBold" numberOfLines={1} style={styles.title}>
        {badge.title}
      </ThemedText>
      <ThemedText type="small" themeColor="textSecondary" numberOfLines={2} style={styles.desc}>
        {badge.description}
      </ThemedText>

      {!badge.earned && (
        <View style={styles.progressWrap}>
          <View style={[styles.progressTrack, { backgroundColor: theme.backgroundSelected }]}>
            <View
              style={[styles.progressFill, { backgroundColor: theme.accent, width: `${ratio * 100}%` }]}
            />
          </View>
          <ThemedText type="small" themeColor="textSecondary" style={styles.progressText}>
            {badge.progress}/{badge.threshold}
          </ThemedText>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  container: { gap: Spacing.four, padding: Spacing.three },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  center: { textAlign: 'center', marginTop: -Spacing.two },
  section: { gap: Spacing.two },
  sectionLabel: { letterSpacing: 1 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.three },
  card: {
    width: '47%',
    flexGrow: 1,
    borderRadius: 14,
    padding: Spacing.three,
    gap: Spacing.one,
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.one,
  },
  check: { position: 'absolute', bottom: -2, right: -2, borderRadius: 10 },
  title: { marginTop: 2 },
  desc: { minHeight: 32 },
  progressWrap: { gap: 3, marginTop: Spacing.one },
  progressTrack: { height: 5, borderRadius: 3, overflow: 'hidden' },
  progressFill: { height: 5, borderRadius: 3 },
  progressText: { fontSize: 11 },
});
