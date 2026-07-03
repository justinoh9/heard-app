import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AlbumCover } from '@/components/album-cover';
import { PageContainer } from '@/components/page-container';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useConcerts } from '@/concerts/store';
import { Spacing } from '@/constants/theme';
import { computeStats } from '@/data/stats';
import { useRatings } from '@/data/store';
import { useTheme } from '@/hooks/use-theme';
import { useStreaks } from '@/streaks/store';

const ACCENT = '#1D9E75';
const BAR_TINTS = ['#E24B4A', '#EF9F27', '#EFD927', '#8FD14F', '#1D9E75'];

/**
 * The always-on Wrapped (PRODUCT_BLUEPRINT §2.D): not a December drop — a
 * live stats dashboard recomputed from the diary on every visit. Pushed from
 * the Profile tab.
 */
export default function WrappedScreen() {
  const theme = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { ranked } = useRatings();
  const { concerts } = useConcerts();
  const { current: streak, longest } = useStreaks();

  const stats = computeStats(ranked, concerts);
  const maxBucket = Math.max(1, ...stats.histogram.map((b) => b.count));
  const maxDecade = Math.max(1, ...stats.topDecades.map((b) => b.count));
  const maxArtist = Math.max(1, ...stats.topArtists.map((a) => a.count));

  return (
    <ThemedView style={[styles.screen, { paddingTop: insets.top }]}>
      <ScrollView>
        <PageContainer style={styles.container}>
          <View style={styles.header}>
            <Pressable onPress={() => router.back()} accessibilityLabel="Back" hitSlop={8}>
              <Ionicons name="chevron-back" size={24} color={theme.text} />
            </Pressable>
            <ThemedText type="subtitle">Your Wrapped</ThemedText>
            <View style={{ width: 24 }} />
          </View>
          <ThemedText type="small" themeColor="textSecondary" style={styles.center}>
            Live from your diary — no December required.
          </ThemedText>

          <View style={styles.statGrid}>
            <BigStat value={String(stats.ratedCount)} label="rated" theme={theme} />
            <BigStat
              value={stats.meanScore != null ? stats.meanScore.toFixed(1) : '—'}
              label="avg score"
              theme={theme}
            />
            <BigStat value={String(stats.concertCount)} label="shows" theme={theme} />
            <BigStat value={`${streak}🔥`} label={`streak (best ${longest})`} theme={theme} />
          </View>

          {stats.highest && (
            <View style={[styles.card, { backgroundColor: theme.backgroundElement }]}>
              <ThemedText type="smallBold" themeColor="textSecondary">
                YOUR #1
              </ThemedText>
              <View style={styles.highestRow}>
                <AlbumCover uri={stats.highest.item.artUrl} size={72} radius={10} />
                <View style={{ flex: 1 }}>
                  <ThemedText type="subtitle" numberOfLines={2}>
                    {stats.highest.item.title}
                  </ThemedText>
                  <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
                    {stats.highest.item.artist}
                  </ThemedText>
                </View>
                <ThemedText type="subtitle" style={{ color: ACCENT }}>
                  {stats.highest.score.toFixed(1)}
                </ThemedText>
              </View>
            </View>
          )}

          <View style={[styles.card, { backgroundColor: theme.backgroundElement }]}>
            <ThemedText type="smallBold" themeColor="textSecondary">
              HOW YOU RATE
            </ThemedText>
            {stats.histogram.map((b, i) => (
              <View key={b.label} style={styles.barRow}>
                <ThemedText type="small" themeColor="textSecondary" style={styles.barLabel}>
                  {b.label}
                </ThemedText>
                <View style={styles.barTrack}>
                  <View
                    style={[
                      styles.barFill,
                      {
                        backgroundColor: BAR_TINTS[i],
                        width: `${Math.max(2, (b.count / maxBucket) * 100)}%`,
                        opacity: b.count === 0 ? 0.15 : 1,
                      },
                    ]}
                  />
                </View>
                <ThemedText type="small" style={styles.barCount}>
                  {b.count}
                </ThemedText>
              </View>
            ))}
          </View>

          {stats.topArtists.length > 0 && (
            <View style={[styles.card, { backgroundColor: theme.backgroundElement }]}>
              <ThemedText type="smallBold" themeColor="textSecondary">
                MOST RATED ARTISTS
              </ThemedText>
              {stats.topArtists.map((a, i) => (
                <View key={a.name} style={styles.barRow}>
                  <ThemedText type="small" numberOfLines={1} style={styles.artistLabel}>
                    {i + 1}. {a.name}
                  </ThemedText>
                  <View style={styles.barTrack}>
                    <View
                      style={[
                        styles.barFill,
                        { backgroundColor: ACCENT, width: `${(a.count / maxArtist) * 100}%` },
                      ]}
                    />
                  </View>
                  <ThemedText type="small" style={styles.barCount}>
                    {a.count} · {a.meanScore.toFixed(1)}
                  </ThemedText>
                </View>
              ))}
            </View>
          )}

          {stats.topDecades.length > 0 && (
            <View style={[styles.card, { backgroundColor: theme.backgroundElement }]}>
              <ThemedText type="smallBold" themeColor="textSecondary">
                YOUR DECADES
              </ThemedText>
              {stats.topDecades.map((d) => (
                <View key={d.label} style={styles.barRow}>
                  <ThemedText type="small" themeColor="textSecondary" style={styles.barLabel}>
                    {d.label}
                  </ThemedText>
                  <View style={styles.barTrack}>
                    <View
                      style={[
                        styles.barFill,
                        { backgroundColor: '#378ADD', width: `${(d.count / maxDecade) * 100}%` },
                      ]}
                    />
                  </View>
                  <ThemedText type="small" style={styles.barCount}>
                    {d.count}
                  </ThemedText>
                </View>
              ))}
            </View>
          )}

          {stats.topVenue && (
            <View style={[styles.card, styles.venueCard, { backgroundColor: theme.backgroundElement }]}>
              <Ionicons name="mic" size={20} color={ACCENT} />
              <ThemedText type="small">
                Your venue: <ThemedText type="smallBold">{stats.topVenue}</ThemedText>
              </ThemedText>
            </View>
          )}
        </PageContainer>
      </ScrollView>
    </ThemedView>
  );
}

function BigStat({
  value,
  label,
  theme,
}: {
  value: string;
  label: string;
  theme: ReturnType<typeof useTheme>;
}) {
  return (
    <View style={[styles.bigStat, { backgroundColor: theme.backgroundElement }]}>
      <ThemedText type="subtitle" style={{ fontSize: 24 }}>
        {value}
      </ThemedText>
      <ThemedText type="small" themeColor="textSecondary" style={styles.center}>
        {label}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  container: { padding: Spacing.three, gap: Spacing.three },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  center: { textAlign: 'center' },
  statGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  bigStat: {
    flexBasis: '45%',
    flexGrow: 1,
    alignItems: 'center',
    paddingVertical: Spacing.four,
    borderRadius: 12,
    gap: 2,
  },
  card: { borderRadius: 12, padding: Spacing.three, gap: Spacing.two },
  highestRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  barRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  barLabel: { width: 44 },
  artistLabel: { width: 120 },
  barTrack: { flex: 1, height: 10, borderRadius: 5, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 5 },
  barCount: { minWidth: 52, textAlign: 'right' },
  venueCard: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
});
