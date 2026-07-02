import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { AlbumCover } from '@/components/album-cover';
import { EmptyState } from '@/components/empty-state';
import { PageContainer } from '@/components/page-container';
import { PlaylistCover } from '@/components/playlist-cover';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useConcerts } from '@/concerts/store';
import { Spacing } from '@/constants/theme';
import { PROFILE } from '@/data/catalog';
import { useAuth } from '@/auth/store';
import { useRatings } from '@/data/store';
import { useTheme } from '@/hooks/use-theme';
import { playlistCoverUrls, songCountLabel } from '@/playlists/helpers';
import { usePlaylists } from '@/playlists/store';
import type { RankedItem } from '@/ranking/types';
import { resolveFavorites, TOP_FAVORITES } from '@/social/favorites';
import { useSocial } from '@/social/store';
import { useStreaks } from '@/streaks/store';

const BADGE_TINTS = ['#993556', '#854F0B', '#185FA5'];

function initialsFrom(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  return (parts[0][0] + (parts[1]?.[0] ?? '')).toUpperCase();
}

export default function ProfileScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { ranked } = useRatings();
  const { user } = useAuth();
  const { playlists } = usePlaylists();
  const { current: streak } = useStreaks();
  const { myFavorites, saveFavorites } = useSocial();
  const { concerts } = useConcerts();
  const [editingTop4, setEditingTop4] = useState(false);
  const [picking, setPicking] = useState(false);

  // The showcase: chosen Top 4, falling back to the top of the ranked list.
  const { items: top4, chosen } = resolveFavorites(myFavorites, ranked);
  const emptySlots = editingTop4 ? TOP_FAVORITES - top4.length : 0;

  /** Editing an unchosen (fallback) grid first materializes what's on screen. */
  function currentIds(): string[] {
    return chosen
      ? myFavorites.filter((id) => ranked.some((r) => r.item.id === id))
      : top4.map((r) => r.item.id);
  }

  function addFavorite(itemId: string) {
    saveFavorites([...currentIds(), itemId]);
    setPicking(false);
  }

  function removeFavorite(itemId: string) {
    saveFavorites(currentIds().filter((id) => id !== itemId));
  }

  const displayName = user?.displayName ?? PROFILE.username;
  const initials = user ? initialsFrom(user.displayName) : PROFILE.initials;

  function reRate(r: RankedItem) {
    router.push({
      pathname: '/log',
      params: {
        id: r.item.id,
        type: r.item.type,
        title: r.item.title,
        artist: r.item.artist,
        year: '',
        artUrl: r.item.artUrl ?? '',
      },
    });
  }

  return (
    <ThemedView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <PageContainer style={styles.inner}>
          <View style={styles.header}>
            <View style={[styles.avatar, { backgroundColor: theme.backgroundSelected }]}>
              <ThemedText type="smallBold">{initials}</ThemedText>
            </View>
            <View style={{ flex: 1 }}>
              <ThemedText type="smallBold" style={{ fontSize: 18 }}>
                {displayName}
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {PROFILE.tags} · {ranked.length} rated
              </ThemedText>
            </View>
            <Pressable
              onPress={() => router.push('/settings')}
              accessibilityLabel="Settings"
              style={({ pressed }) => [
                styles.settingsBtn,
                { backgroundColor: theme.backgroundElement, opacity: pressed ? 0.6 : 1 },
              ]}>
              <Ionicons name="settings-outline" size={18} color={theme.textSecondary} />
            </Pressable>
          </View>

          <View style={styles.stats}>
            <Stat value={String(ranked.length)} label="rated" theme={theme} />
            <Stat value={String(concerts.length)} label="shows" theme={theme} />
            <Stat
              value={`${streak}🔥`}
              label="streak"
              theme={theme}
              onPress={() => router.push('/streak')}
              testID="streak-stat"
            />
          </View>

          {ranked.length > 0 && (
            <>
              <View style={styles.top4Header}>
                <ThemedText type="smallBold" themeColor="textSecondary" style={styles.sectionLabel}>
                  TOP 4
                </ThemedText>
                <Pressable
                  testID="edit-top4"
                  onPress={() => setEditingTop4((e) => !e)}
                  hitSlop={8}>
                  <ThemedText type="smallBold" style={{ color: '#1D9E75' }}>
                    {editingTop4 ? 'Done' : 'Edit'}
                  </ThemedText>
                </Pressable>
              </View>
              <View style={styles.favorites}>
                {top4.map((r) => (
                  <Pressable
                    key={r.item.id}
                    style={styles.favorite}
                    onPress={() => (editingTop4 ? removeFavorite(r.item.id) : reRate(r))}
                    accessibilityLabel={
                      editingTop4 ? `Remove ${r.item.title} from Top 4` : `Re-rate ${r.item.title}`
                    }>
                    <View>
                      <AlbumCover uri={r.item.artUrl} fill radius={10} />
                      {editingTop4 && (
                        <View style={styles.removeBadge}>
                          <Ionicons name="close" size={14} color="#fff" />
                        </View>
                      )}
                    </View>
                    <ThemedText type="small" numberOfLines={1} style={styles.favTitle}>
                      {r.item.title}
                    </ThemedText>
                    <ThemedText type="smallBold" style={{ color: '#1D9E75' }}>
                      {r.score.toFixed(1)}
                    </ThemedText>
                  </Pressable>
                ))}
                {Array.from({ length: emptySlots }).map((_, i) => (
                  <Pressable
                    key={`empty-${i}`}
                    testID="add-favorite"
                    onPress={() => setPicking(true)}
                    accessibilityLabel="Add a favorite"
                    style={[styles.favorite, styles.emptySlot, { borderColor: theme.backgroundSelected }]}>
                    <Ionicons name="add" size={28} color={theme.textSecondary} />
                  </Pressable>
                ))}
              </View>
              {!chosen && !editingTop4 && (
                <ThemedText type="small" themeColor="textSecondary">
                  Showing your top rated — tap Edit to choose your defining four.
                </ThemedText>
              )}
            </>
          )}

          <Modal visible={picking} animationType="slide" transparent onRequestClose={() => setPicking(false)}>
            <View style={styles.pickerBackdrop}>
              <View style={[styles.pickerSheet, { backgroundColor: theme.background }]}>
                <View style={styles.pickerHeader}>
                  <ThemedText type="subtitle">Pick a favorite</ThemedText>
                  <Pressable onPress={() => setPicking(false)} accessibilityLabel="Close picker" hitSlop={8}>
                    <Ionicons name="close" size={24} color={theme.text} />
                  </Pressable>
                </View>
                <ScrollView contentContainerStyle={{ gap: Spacing.two }}>
                  {ranked
                    .filter((r) => !currentIds().includes(r.item.id))
                    .map((r) => (
                      <Pressable
                        key={r.item.id}
                        testID={`pick-${r.item.id}`}
                        onPress={() => addFavorite(r.item.id)}
                        style={({ pressed }) => [
                          styles.rankRow,
                          { backgroundColor: theme.backgroundElement, opacity: pressed ? 0.6 : 1 },
                        ]}>
                        <AlbumCover uri={r.item.artUrl} size={44} radius={6} />
                        <View style={{ flex: 1 }}>
                          <ThemedText type="small" numberOfLines={1}>
                            {r.item.title}
                          </ThemedText>
                          <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
                            {r.item.artist}
                          </ThemedText>
                        </View>
                        <ThemedText type="smallBold" style={{ color: '#1D9E75' }}>
                          {r.score.toFixed(1)}
                        </ThemedText>
                      </Pressable>
                    ))}
                </ScrollView>
              </View>
            </View>
          </Modal>

          <ThemedText type="smallBold" themeColor="textSecondary" style={styles.sectionLabel}>
            PLAYLISTS
          </ThemedText>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.playlists}>
            {playlists.map((p) => (
              <Pressable
                key={p.id}
                testID={`playlist-${p.id}`}
                style={styles.playlistCard}
                onPress={() => router.push({ pathname: '/playlist/[id]', params: { id: p.id } })}>
                <PlaylistCover urls={playlistCoverUrls(p)} size={120} radius={10} />
                <ThemedText type="small" numberOfLines={1} style={styles.playlistName}>
                  {p.name}
                </ThemedText>
                <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
                  {songCountLabel(p.songs.length)}
                </ThemedText>
              </Pressable>
            ))}
            <Pressable
              testID="new-playlist"
              style={styles.playlistCard}
              onPress={() => router.push('/playlist/new')}>
              <View
                style={[
                  styles.newPlaylist,
                  { borderColor: theme.backgroundSelected, backgroundColor: theme.backgroundElement },
                ]}>
                <Ionicons name="add" size={32} color={theme.textSecondary} />
              </View>
              <ThemedText type="small" themeColor="textSecondary">
                New playlist
              </ThemedText>
            </Pressable>
          </ScrollView>

          <ThemedText type="smallBold" themeColor="textSecondary" style={styles.sectionLabel}>
            ALL RANKED
          </ThemedText>
          {ranked.length === 0 && (
            <EmptyState
              icon="disc-outline"
              message="Nothing rated yet."
              ctaLabel="Rate your first album"
              onPressCta={() => router.push('/(tabs)/rate')}
            />
          )}
          {ranked.map((r, i) => (
            <Pressable
              key={r.item.id}
              onPress={() => reRate(r)}
              style={({ pressed }) => [
                styles.rankRow,
                { backgroundColor: theme.backgroundElement, opacity: pressed ? 0.6 : 1 },
              ]}>
              <ThemedText type="smallBold" themeColor="textSecondary" style={styles.rankNum}>
                {i + 1}
              </ThemedText>
              <AlbumCover uri={r.item.artUrl} size={44} radius={6} />
              <View style={{ flex: 1 }}>
                <ThemedText type="small" numberOfLines={1}>
                  {r.item.title}
                </ThemedText>
                <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
                  {r.item.artist}
                </ThemedText>
              </View>
              <ThemedText type="smallBold" style={{ color: '#1D9E75' }}>
                {r.score.toFixed(1)}
              </ThemedText>
            </Pressable>
          ))}

          <View style={styles.top4Header}>
            <ThemedText type="smallBold" themeColor="textSecondary" style={styles.sectionLabel}>
              SHOWS
            </ThemedText>
            <Pressable testID="log-show" onPress={() => router.push('/concert/new')} hitSlop={8}>
              <ThemedText type="smallBold" style={{ color: '#1D9E75' }}>
                + Log a show
              </ThemedText>
            </Pressable>
          </View>
          {concerts.length === 0 ? (
            <EmptyState
              icon="mic-outline"
              message="No shows yet — log a concert and start your badge wall."
              ctaLabel="Log a show"
              onPressCta={() => router.push('/concert/new')}
            />
          ) : (
            <View style={styles.badges}>
              {concerts.map((c, i) => (
                <View
                  key={c.id}
                  style={[styles.badge, { backgroundColor: theme.backgroundElement }]}>
                  <Ionicons name="mic" size={22} color={BADGE_TINTS[i % BADGE_TINTS.length]} />
                  <ThemedText type="small" numberOfLines={1} style={{ marginTop: 4 }}>
                    {c.artistName} &apos;{c.showDate.slice(2, 4)}
                  </ThemedText>
                  {c.venue ? (
                    <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
                      {c.venue}
                    </ThemedText>
                  ) : null}
                  {c.score != null ? (
                    <ThemedText type="smallBold" style={{ color: '#1D9E75' }}>
                      {c.score.toFixed(1)}
                    </ThemedText>
                  ) : null}
                </View>
              ))}
            </View>
          )}
        </PageContainer>
      </ScrollView>
    </ThemedView>
  );
}

function Stat({
  value,
  label,
  theme,
  onPress,
  testID,
}: {
  value: string;
  label: string;
  theme: ReturnType<typeof useTheme>;
  onPress?: () => void;
  testID?: string;
}) {
  return (
    <Pressable
      testID={testID}
      disabled={!onPress}
      onPress={onPress}
      style={({ pressed }) => [styles.stat, { backgroundColor: theme.backgroundElement, opacity: pressed ? 0.7 : 1 }]}>
      <ThemedText type="subtitle" style={{ fontSize: 22 }}>
        {value}
      </ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        {label}
      </ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { padding: Spacing.three },
  inner: { gap: Spacing.three },
  header: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  avatar: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center' },
  settingsBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  stats: { flexDirection: 'row', gap: Spacing.two },
  stat: { flex: 1, alignItems: 'center', paddingVertical: Spacing.three, borderRadius: 10, gap: 2 },
  sectionLabel: { marginTop: Spacing.two },
  top4Header: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
  },
  favorites: { flexDirection: 'row', gap: Spacing.two },
  favorite: { flex: 1, gap: 4 },
  favTitle: { marginTop: 2 },
  emptySlot: {
    aspectRatio: 1,
    borderRadius: 10,
    borderWidth: 1,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeBadge: {
    position: 'absolute',
    top: -6,
    right: -6,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#E24B4A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pickerBackdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' },
  pickerSheet: {
    maxHeight: '70%',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: Spacing.three,
    gap: Spacing.three,
  },
  pickerHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  playlists: { gap: Spacing.three, paddingRight: Spacing.three },
  playlistCard: { width: 120, gap: 4 },
  playlistName: { marginTop: 2 },
  newPlaylist: {
    width: 120,
    height: 120,
    borderRadius: 10,
    borderWidth: 1,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  rankRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, padding: Spacing.two, borderRadius: 10 },
  rankNum: { width: 16, textAlign: 'center' },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  badge: {
    flexBasis: '30%',
    flexGrow: 1,
    maxWidth: '48%',
    alignItems: 'center',
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.two,
    borderRadius: 12,
  },
});
