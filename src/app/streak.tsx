import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { EmptyState } from '@/components/empty-state';
import { PageContainer } from '@/components/page-container';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { todayKey } from '@/streaks/logic';
import { useStreaks } from '@/streaks/store';

const GRID_DAYS = 28;

/** Last `GRID_DAYS` 'YYYY-MM-DD' keys ending today, oldest first. */
function recentDays(count: number): string[] {
  const now = Date.now();
  const days: string[] = [];
  for (let i = count - 1; i >= 0; i--) {
    days.push(todayKey(now - i * 86400000));
  }
  return days;
}

export default function StreakScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { current, longest, activeDates } = useStreaks();

  const active = new Set(activeDates);
  const grid = recentDays(GRID_DAYS);
  const today = todayKey();

  return (
    <ThemedView style={styles.screen}>
      <View style={styles.topBar}>
        <Pressable onPress={() => router.back()} accessibilityLabel="Back" hitSlop={8}>
          <Ionicons name="chevron-back" size={26} color={theme.text} />
        </Pressable>
        <ThemedText type="smallBold">Streak</ThemedText>
        <View style={{ width: 26 }} />
      </View>

      <View style={styles.content}>
        <PageContainer style={styles.inner}>
          <View style={styles.hero}>
            <ThemedText type="subtitle" style={styles.current}>
              {current}🔥
            </ThemedText>
            <ThemedText themeColor="textSecondary">
              {current === 1 ? 'day' : 'days'} in a row
            </ThemedText>
          </View>

          <View style={[styles.longest, { backgroundColor: theme.backgroundElement }]}>
            <ThemedText type="smallBold" style={{ fontSize: 20 }}>
              {longest}
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              longest streak
            </ThemedText>
          </View>

          <ThemedText type="smallBold" themeColor="textSecondary" style={styles.sectionLabel}>
            LAST {GRID_DAYS} DAYS
          </ThemedText>

          {activeDates.length === 0 ? (
            <EmptyState icon="flame-outline" message="Rate something or post a drop to start a streak." />
          ) : (
            <View style={styles.grid}>
              {grid.map((day) => (
                <View
                  key={day}
                  style={[
                    styles.cell,
                    {
                      backgroundColor: active.has(day) ? '#1D9E75' : theme.backgroundElement,
                      borderColor: day === today ? '#1D9E75' : 'transparent',
                    },
                  ]}
                />
              ))}
            </View>
          )}
        </PageContainer>
      </View>
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
  content: { padding: Spacing.three },
  inner: { gap: Spacing.three },
  hero: { alignItems: 'center', gap: 4, marginTop: Spacing.two },
  current: { fontSize: 40 },
  longest: { alignItems: 'center', paddingVertical: Spacing.three, borderRadius: 12, gap: 2 },
  sectionLabel: { marginTop: Spacing.two },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  cell: { width: 28, height: 28, borderRadius: 6, borderWidth: 2 },
});
