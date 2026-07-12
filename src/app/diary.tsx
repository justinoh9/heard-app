/**
 * Listen diary timeline (ROADMAP Phase 2). The viewer's dated log entries,
 * grouped by day, newest first — Letterboxd's diary for music. Re-logging an
 * album on a new day shows as a fresh entry, so this is the running habit
 * record (distinct from the deduped ranked list on the profile).
 */

import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { useAuth } from '@/auth/store';
import { AlbumCover } from '@/components/album-cover';
import { EmptyState } from '@/components/empty-state';
import { PageContainer } from '@/components/page-container';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { diaryBackend } from '@/diary/provider';
import { formatDiaryDate, groupByDay, type DiaryDay } from '@/diary/rows';
import type { DiaryEntry } from '@/diary/types';
import { useTheme } from '@/hooks/use-theme';

export default function DiaryScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { user } = useAuth();
  const userId = user?.id ?? null;

  const [entries, setEntries] = useState<DiaryEntry[] | null>(null);

  useEffect(() => {
    if (!userId) {
      setEntries([]);
      return;
    }
    let cancelled = false;
    diaryBackend
      .listFor(userId)
      .then((list) => {
        if (!cancelled) setEntries(list);
      })
      .catch((e: unknown) => {
        console.warn('[diary] load failed:', e);
        if (!cancelled) setEntries([]);
      });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const days: DiaryDay[] = entries ? groupByDay(entries) : [];

  function openItem(entry: DiaryEntry) {
    router.push({
      pathname: '/item/[id]',
      params: {
        id: entry.item.id,
        type: entry.item.type,
        title: entry.item.title,
        artist: entry.item.artist,
        artUrl: entry.item.artUrl ?? '',
      },
    });
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
        <ThemedText type="smallBold">Your diary</ThemedText>
        <View style={{ width: 26 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <PageContainer style={styles.inner}>
          {entries === null && <ActivityIndicator color={theme.accent} style={{ marginTop: Spacing.four }} />}

          {entries !== null && entries.length === 0 && (
            <EmptyState
              icon="book-outline"
              doodle="cassette"
              message="Your listening diary is empty. Every album or song you log lands here — log the same one again another day to build your timeline."
              ctaLabel="Rate something"
              onPressCta={() => router.push('/(tabs)/rate')}
            />
          )}

          {entries !== null && entries.length > 0 && (
            <ThemedText type="small" themeColor="textSecondary">
              {entries.length} {entries.length === 1 ? 'entry' : 'entries'}
            </ThemedText>
          )}

          {days.map((day) => (
            <View key={day.date} style={styles.day}>
              <ThemedText type="smallBold" themeColor="textSecondary" style={styles.dayLabel}>
                {formatDiaryDate(day.date)}
              </ThemedText>
              {day.entries.map((entry) => (
                <Pressable
                  key={entry.id}
                  testID={`diary-${entry.id}`}
                  onPress={() => openItem(entry)}
                  style={({ pressed }) => [
                    styles.row,
                    { backgroundColor: theme.backgroundElement, opacity: pressed ? 0.7 : 1 },
                  ]}>
                  <AlbumCover uri={entry.item.artUrl} size={48} radius={8} />
                  <View style={{ flex: 1 }}>
                    <ThemedText type="smallBold" numberOfLines={1}>
                      {entry.item.title}
                    </ThemedText>
                    <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
                      {entry.item.artist}
                    </ThemedText>
                    {entry.note ? (
                      <ThemedText type="small" numberOfLines={2} style={styles.note}>
                        “{entry.note}”
                      </ThemedText>
                    ) : null}
                  </View>
                  <View style={[styles.scorePill, { backgroundColor: theme.accent }]}>
                    <ThemedText type="smallBold" style={{ color: theme.onAccent }}>
                      {entry.score.toFixed(1)}
                    </ThemedText>
                  </View>
                </Pressable>
              ))}
            </View>
          ))}
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
  content: { padding: Spacing.three },
  inner: { gap: Spacing.three },
  day: { gap: Spacing.two },
  dayLabel: { marginTop: Spacing.two },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    padding: Spacing.three,
    borderRadius: 12,
  },
  note: { fontStyle: 'italic', marginTop: 2 },
  scorePill: {
    borderRadius: 999,
    minWidth: 40,
    paddingHorizontal: Spacing.two,
    paddingVertical: 3,
    alignItems: 'center',
  },
});
