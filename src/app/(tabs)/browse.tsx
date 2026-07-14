import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';

import { AdSlot } from '@/components/ad-slot';
import { AlbumCover } from '@/components/album-cover';
import { EmptyState } from '@/components/empty-state';
import { JelliLoader } from '@/components/jelli-loader';
import { PageContainer } from '@/components/page-container';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { browseDecades, browseGenres, forDecade, forGenre, topRated, trending } from '@/browse/aggregate';
import { CURATED_GENRES } from '@/browse/genres';
import { browseBackend } from '@/browse/provider';
import type { BrowseItem } from '@/browse/types';
import type { Item } from '@/ranking/types';
import type { PopularPick } from '@/recommendations/popular';
import { useRecommendations } from '@/recommendations/use-recommendations';
import type { Recommendation } from '@/recommendations/recommend';

/**
 * Browse & discovery (ROADMAP G2): the non-social surfaces both Beli and
 * Letterboxd have — trending this week, top-rated, and by-genre — over real
 * community ratings. Open to guests (browsing needs no account), and a
 * content-rich, crawlable page for the ad/SEO strategy.
 */
export default function BrowseScreen() {
  const theme = useTheme();
  const router = useRouter();
  const [items, setItems] = useState<BrowseItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(false);
  // One active filter across both chip rails — a pick on either rail replaces
  // the other (genre AND decade at once is a Phase-4 nicety, not v1).
  const [filter, setFilter] = useState<{ kind: 'genre' | 'decade'; value: string } | null>(null);
  const { forYou, popular } = useRecommendations();

  const load = useCallback(() => {
    setError(false);
    return browseBackend
      .load()
      .then(setItems)
      .catch((e: unknown) => {
        console.warn('[browse] load failed:', e);
        setError(true);
      });
  }, []);

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, [load]);

  function refresh() {
    setRefreshing(true);
    load().finally(() => setRefreshing(false));
  }

  function openItem(item: BrowseItem) {
    router.push({
      pathname: '/item/[id]',
      params: {
        id: item.id,
        type: item.type,
        title: item.title,
        artist: item.artist,
        artUrl: item.artUrl ?? '',
        year: item.releaseYear ? String(item.releaseYear) : '',
        genre: item.genres?.[0] ?? '',
      },
    });
  }

  // For-you and popular rows carry engine Items (year/genre as strings), not
  // BrowseItems — hence the separate opener.
  function openRankedItem(item: Item) {
    router.push({
      pathname: '/item/[id]',
      params: {
        id: item.id,
        type: item.type,
        title: item.title,
        artist: item.artist,
        artUrl: item.artUrl ?? '',
        year: item.year ?? '',
        genre: item.genre ?? '',
      },
    });
  }

  const genres = browseGenres(items, 2);
  const decades = browseDecades(items, 2);
  const trendingItems = trending(items);
  const topItems = topRated(items);
  const filteredItems = filter
    ? filter.kind === 'genre'
      ? forGenre(items, filter.value)
      : forDecade(items, filter.value)
    : [];

  if (loading) {
    return (
      <ThemedView style={[styles.screen, styles.center]}>
        <JelliLoader />
      </ThemedView>
    );
  }

  if (error) {
    return (
      <ThemedView style={styles.screen}>
        <EmptyState
          icon="cloud-offline-outline"
          message="Couldn't load browse. Pull to try again."
        />
      </ThemedView>
    );
  }

  if (items.length === 0) {
    return (
      <ThemedView style={styles.screen}>
        <EmptyState
          icon="compass-outline"
          doodle="vinyl"
          message="Browse fills in as the community rates music. Be the first — rate something."
        />
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.screen}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={theme.accent} />
        }>
        <PageContainer>
          {filter === null && forYou.length > 0 && (
            <View style={styles.section}>
              <ThemedText type="subtitle" style={styles.sectionHeader}>
                For you
              </ThemedText>
              {forYou.map((rec, i) => (
                <ForYouRow
                  key={rec.item.id}
                  rank={i + 1}
                  rec={rec}
                  onPress={() => openRankedItem(rec.item)}
                />
              ))}
            </View>
          )}

          {filter === null && popular.length > 0 && (
            <View style={styles.section}>
              <ThemedText type="subtitle" style={styles.sectionHeader}>
                Popular among people you follow
              </ThemedText>
              {popular.map((pick, i) => (
                <PopularRow
                  key={pick.item.id}
                  rank={i + 1}
                  pick={pick}
                  onPress={() => openRankedItem(pick.item)}
                />
              ))}
            </View>
          )}

          {genres.length > 0 && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.chips}>
              <Chip label="All" active={filter === null} onPress={() => setFilter(null)} />
              {genres.map((g) => (
                <Chip
                  key={g}
                  label={g}
                  active={filter?.kind === 'genre' && filter.value === g}
                  onPress={() => setFilter({ kind: 'genre', value: g })}
                />
              ))}
            </ScrollView>
          )}

          {decades.length > 0 && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={[styles.chips, genres.length > 0 && styles.chipsSecondRail]}>
              {/* The genre rail owns the "All" chip; offer it here only when
                  that rail isn't rendered, so the filter is always clearable. */}
              {genres.length === 0 && (
                <Chip label="All" active={filter === null} onPress={() => setFilter(null)} />
              )}
              {decades.map((d) => (
                <Chip
                  key={d}
                  label={d}
                  active={filter?.kind === 'decade' && filter.value === d}
                  onPress={() => setFilter({ kind: 'decade', value: d })}
                />
              ))}
            </ScrollView>
          )}

          {filter ? (
            <Section
              title={filter.kind === 'genre' ? `Top in ${filter.value}` : `Best of the ${filter.value}`}
              items={filteredItems}
              onPick={openItem}
              emptyNote={
                filter.kind === 'genre'
                  ? 'Nothing rated in this genre yet.'
                  : 'Nothing rated from this decade yet.'
              }
            />
          ) : (
            <>
              <Section
                title="Trending this week"
                items={trendingItems}
                onPick={openItem}
                emptyNote="No new activity this week — check back soon."
                showRecent
              />
              <Section title="Top rated" items={topItems} onPick={openItem} />
            </>
          )}

          <View style={styles.section}>
            <ThemedText type="subtitle" style={styles.sectionHeader}>
              Browse by genre
            </ThemedText>
            <View style={styles.genreLinks}>
              {CURATED_GENRES.map((g) => (
                <Chip
                  key={g.slug}
                  label={g.label}
                  active={false}
                  onPress={() =>
                    router.push({ pathname: '/browse/genre/[genre]', params: { genre: g.slug } })
                  }
                />
              ))}
            </View>
          </View>

          <AdSlot slot={process.env.EXPO_PUBLIC_ADSENSE_SLOT_BROWSE} />
        </PageContainer>
      </ScrollView>
    </ThemedView>
  );
}

function Chip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        {
          backgroundColor: active ? theme.accent : theme.backgroundElement,
          opacity: pressed ? 0.7 : 1,
        },
      ]}>
      <ThemedText type="smallBold" style={{ color: active ? theme.onAccent : theme.text }}>
        {label}
      </ThemedText>
    </Pressable>
  );
}

function Section({
  title,
  items,
  onPick,
  emptyNote,
  showRecent,
}: {
  title: string;
  items: BrowseItem[];
  onPick: (i: BrowseItem) => void;
  emptyNote?: string;
  showRecent?: boolean;
}) {
  return (
    <View style={styles.section}>
      <ThemedText type="subtitle" style={styles.sectionHeader}>
        {title}
      </ThemedText>
      {items.length === 0 ? (
        <ThemedText type="small" themeColor="textSecondary">
          {emptyNote ?? 'Nothing here yet.'}
        </ThemedText>
      ) : (
        items.map((item, i) => (
          <BrowseRow key={item.id} rank={i + 1} item={item} onPress={() => onPick(item)} showRecent={showRecent} />
        ))
      )}
    </View>
  );
}

function BrowseRow({
  rank,
  item,
  onPress,
  showRecent,
}: {
  rank: number;
  item: BrowseItem;
  onPress: () => void;
  showRecent?: boolean;
}) {
  const theme = useTheme();
  const ratingsLabel = `${item.ratingCount} ${item.ratingCount === 1 ? 'rating' : 'ratings'}`;
  const subtitle = showRecent
    ? `${item.artist} · ${item.recentCount} this week`
    : `${item.artist} · ${ratingsLabel}`;
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.row, { opacity: pressed ? 0.6 : 1 }]}>
      <ThemedText type="smallBold" themeColor="textSecondary" style={styles.rank}>
        {rank}
      </ThemedText>
      <AlbumCover uri={item.artUrl} size={52} radius={item.type === 'artist' ? 26 : 8} />
      <View style={styles.rowText}>
        <ThemedText type="smallBold" numberOfLines={1}>
          {item.title}
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
          {subtitle}
        </ThemedText>
      </View>
      <View style={[styles.scorePill, { backgroundColor: theme.accent }]}>
        <ThemedText type="smallBold" style={{ color: theme.onAccent }}>
          {item.avgScore.toFixed(1)}
        </ThemedText>
      </View>
    </Pressable>
  );
}

function ForYouRow({
  rank,
  rec,
  onPress,
}: {
  rank: number;
  rec: Recommendation;
  onPress: () => void;
}) {
  const theme = useTheme();
  // "Maya rated 9.2" — the taste-twin pitch; append the match when it's strong.
  const match = rec.compatibility > 0 ? ` · ${rec.compatibility}% match` : '';
  const subtitle = `${rec.friendName} rated ${rec.friendScore.toFixed(1)}${match}`;
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.row, { opacity: pressed ? 0.6 : 1 }]}>
      <ThemedText type="smallBold" themeColor="textSecondary" style={styles.rank}>
        {rank}
      </ThemedText>
      <AlbumCover uri={rec.item.artUrl} size={52} radius={rec.item.type === 'artist' ? 26 : 8} />
      <View style={styles.rowText}>
        <ThemedText type="smallBold" numberOfLines={1}>
          {rec.item.title}
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
          {subtitle}
        </ThemedText>
      </View>
      <View style={[styles.scorePill, { backgroundColor: theme.accentSoft }]}>
        <ThemedText type="smallBold" style={{ color: theme.accent }}>
          {rec.friendScore.toFixed(1)}
        </ThemedText>
      </View>
    </Pressable>
  );
}

function PopularRow({
  rank,
  pick,
  onPress,
}: {
  rank: number;
  pick: PopularPick;
  onPress: () => void;
}) {
  const theme = useTheme();
  const friendsLabel = `${pick.friendCount} ${pick.friendCount === 1 ? 'friend' : 'friends'} rated it`;
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.row, { opacity: pressed ? 0.6 : 1 }]}>
      <ThemedText type="smallBold" themeColor="textSecondary" style={styles.rank}>
        {rank}
      </ThemedText>
      <AlbumCover uri={pick.item.artUrl} size={52} radius={pick.item.type === 'artist' ? 26 : 8} />
      <View style={styles.rowText}>
        <ThemedText type="smallBold" numberOfLines={1}>
          {pick.item.title}
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
          {pick.item.artist} · {friendsLabel}
        </ThemedText>
      </View>
      <View style={[styles.scorePill, { backgroundColor: theme.accent }]}>
        <ThemedText type="smallBold" style={{ color: theme.onAccent }}>
          {pick.avgScore.toFixed(1)}
        </ThemedText>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  center: { alignItems: 'center', justifyContent: 'center' },
  content: { paddingBottom: Spacing.six },
  chips: { gap: Spacing.two, paddingVertical: Spacing.three },
  genreLinks: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  // Stacked under the genre rail — collapse the doubled vertical padding.
  chipsSecondRail: { paddingTop: 0 },
  chip: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: 999,
  },
  section: { marginTop: Spacing.three, gap: Spacing.one },
  sectionHeader: { marginBottom: Spacing.one },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingVertical: Spacing.two,
  },
  rank: { width: 20, textAlign: 'center' },
  rowText: { flex: 1, gap: 2 },
  scorePill: {
    borderRadius: 999,
    minWidth: 40,
    paddingHorizontal: Spacing.two,
    paddingVertical: 4,
    alignItems: 'center',
  },
});
