import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { forAnyGenre } from '@/browse/aggregate';
import { CURATED_GENRES, genreBySlug } from '@/browse/genres';
import { browseBackend } from '@/browse/provider';
import type { BrowseItem } from '@/browse/types';
import { AdSlot } from '@/components/ad-slot';
import { AlbumCover } from '@/components/album-cover';
import { EmptyState } from '@/components/empty-state';
import { PageContainer } from '@/components/page-container';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/**
 * Curated genre landing page (ROADMAP G2 follow-up): /browse/genre/[slug].
 * Every curated slug is statically exported (generateStaticParams below), and
 * the heading + blurb are static copy — so each page ships real, unique,
 * crawlable text in its HTML while the ranked list hydrates from live
 * community ratings in the browser. These are the SEO/ad surfaces the Browse
 * tab links to under "Browse by genre".
 */

export function generateStaticParams(): { genre: string }[] {
  return CURATED_GENRES.map((g) => ({ genre: g.slug }));
}

export default function GenrePage() {
  const theme = useTheme();
  const router = useRouter();
  const { genre: slug } = useLocalSearchParams<{ genre: string }>();
  const curated = genreBySlug(slug);

  const [items, setItems] = useState<BrowseItem[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let live = true;
    browseBackend
      .load()
      .then((res) => {
        if (live) setItems(res);
      })
      .catch((e: unknown) => console.warn('[browse/genre] load failed:', e))
      .finally(() => {
        if (live) setLoaded(true);
      });
    return () => {
      live = false;
    };
  }, []);

  function goBack() {
    if (router.canGoBack()) router.back();
    else router.replace('/browse');
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

  if (!curated) {
    return (
      <ThemedView style={styles.screen}>
        <TopBar onBack={goBack} title="Browse" />
        <EmptyState icon="compass-outline" message="We don't have a page for that genre yet." />
      </ThemedView>
    );
  }

  const ranked = forAnyGenre(items, curated.itunes);

  return (
    <ThemedView style={styles.screen}>
      <TopBar onBack={goBack} title={curated.label} />
      <ScrollView contentContainerStyle={styles.content}>
        <PageContainer style={styles.inner}>
          <ThemedText type="title">Best {curated.label} music</ThemedText>
          <ThemedText themeColor="textSecondary">{curated.blurb}</ThemedText>

          <View style={styles.list}>
            {ranked.length > 0 ? (
              ranked.map((item, i) => (
                <Row key={item.id} rank={i + 1} item={item} onPress={() => openItem(item)} />
              ))
            ) : (
              <ThemedText type="small" themeColor="textSecondary">
                {loaded
                  ? `No ${curated.label} ratings yet — this chart fills in as the community rates. Be the first: search anything and score it.`
                  : 'Loading the community chart…'}
              </ThemedText>
            )}
          </View>

          <Pressable onPress={() => router.push('/browse')} hitSlop={4}>
            <ThemedText type="linkPrimary">Browse all genres</ThemedText>
          </Pressable>

          <AdSlot slot={process.env.EXPO_PUBLIC_ADSENSE_SLOT_BROWSE} />
        </PageContainer>
      </ScrollView>
    </ThemedView>
  );
}

function TopBar({ onBack, title }: { onBack: () => void; title: string }) {
  const theme = useTheme();
  return (
    <View style={styles.topBar}>
      <Pressable onPress={onBack} accessibilityLabel="Back" hitSlop={8}>
        <Ionicons name="chevron-back" size={26} color={theme.text} />
      </Pressable>
      <ThemedText type="smallBold">{title}</ThemedText>
      <View style={{ width: 26 }} />
    </View>
  );
}

function Row({ rank, item, onPress }: { rank: number; item: BrowseItem; onPress: () => void }) {
  const theme = useTheme();
  const ratingsLabel = `${item.ratingCount} ${item.ratingCount === 1 ? 'rating' : 'ratings'}`;
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
          {item.artist} · {ratingsLabel}
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
  list: { gap: Spacing.one },
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
