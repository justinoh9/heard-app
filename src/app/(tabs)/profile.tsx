import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { AlbumCover } from '@/components/album-cover';
import { EmptyState } from '@/components/empty-state';
import { GuestGate } from '@/components/guest-gate';
import { PageContainer } from '@/components/page-container';
import { PlaylistCover } from '@/components/playlist-cover';
import { Segmented } from '@/components/segmented';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { computeAchievements } from '@/achievements/logic';
import { useConcerts } from '@/concerts/store';
import { DisplayFont, Spacing, Stage } from '@/constants/theme';
import { PROFILE } from '@/data/catalog';
import { useAuth } from '@/auth/store';
import { useRatings } from '@/data/store';
import { useTheme } from '@/hooks/use-theme';
import { playlistCoverUrls, songCountLabel } from '@/playlists/helpers';
import { usePlaylists } from '@/playlists/store';
import type { ItemType, RankedItem } from '@/ranking/types';
import { socialBackend } from '@/social/provider';
import { resolveFavorites, TOP_FAVORITES } from '@/social/favorites';
import { useSocial } from '@/social/store';
import { useStreaks } from '@/streaks/store';

function initialsFrom(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  return (parts[0][0] + (parts[1]?.[0] ?? '')).toUpperCase();
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** Ranked-list type tabs, in display order, with their plural labels. */
const RANK_TYPE_ORDER: ItemType[] = ['album', 'song', 'artist'];
const RANK_TYPE_LABEL: Record<ItemType, string> = { album: 'Albums', song: 'Songs', artist: 'Artists' };

/** '2026-07-02' → 'Jul 2, 2026' (year dropped when it's the current one). */
function showDateLabel(showDate: string): string {
  const [y, m, d] = showDate.split('-').map((p) => Number.parseInt(p, 10));
  if (!y || !m || !d) return showDate;
  const base = `${MONTHS[m - 1]} ${d}`;
  return y === new Date().getFullYear() ? base : `${base}, ${y}`;
}

export default function ProfileScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { ranked } = useRatings();
  const { user } = useAuth();
  const { playlists } = usePlaylists();
  const { current: streak, longest } = useStreaks();
  const { myFavorites, saveFavorites, followingIds } = useSocial();
  const { concerts } = useConcerts();
  const [editingTop4, setEditingTop4] = useState(false);
  const [picking, setPicking] = useState(false);
  const [rankFilter, setRankFilter] = useState<string>('all');
  const [followerCount, setFollowerCount] = useState(0);

  useEffect(() => {
    if (!user) {
      setFollowerCount(0);
      return;
    }
    let cancelled = false;
    socialBackend
      .followers(user.id)
      .then((f) => {
        if (!cancelled) setFollowerCount(f.length);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [user]);

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

  const badges = computeAchievements({ ranked, concerts, longestStreak: longest });

  // Per-type ranked lists (blueprint §2.B): tab across the types actually rated.
  const typeCounts = ranked.reduce<Record<string, number>>((m, r) => {
    m[r.item.type] = (m[r.item.type] ?? 0) + 1;
    return m;
  }, {});
  const presentTypes = RANK_TYPE_ORDER.filter((t) => typeCounts[t]);
  const rankOptions = [
    { key: 'all', label: `All ${ranked.length}` },
    ...presentTypes.map((t) => ({ key: t, label: `${RANK_TYPE_LABEL[t]} ${typeCounts[t]}` })),
  ];
  // Fall back to All if the active tab's type no longer exists (e.g. after a re-rate).
  const activeRankFilter = rankOptions.some((o) => o.key === rankFilter) ? rankFilter : 'all';
  const visibleRanked =
    activeRankFilter === 'all' ? ranked : ranked.filter((r) => r.item.type === activeRankFilter);

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

  // Browsing is open to everyone, but a profile is personal — guests see a CTA.
  if (!user) {
    return (
      <GuestGate
        icon="person-circle-outline"
        title="Your profile lives here"
        message="Sign in to rate albums, build your ranked list, log shows, and follow friends."
      />
    );
  }

  return (
    <ThemedView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <PageContainer style={styles.inner}>
          <View style={styles.header}>
            <View style={[styles.avatar, { backgroundColor: theme.backgroundSelected }]}>
              <ThemedText style={styles.avatarInitial}>{initials}</ThemedText>
            </View>
            <View style={{ flex: 1 }}>
              <ThemedText style={styles.displayName}>{displayName}</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {PROFILE.tags} · {ranked.length} rated
              </ThemedText>
              {user && (
                <View style={styles.connections}>
                  <Pressable
                    testID="open-followers"
                    hitSlop={6}
                    onPress={() =>
                      router.push({ pathname: '/connections', params: { id: user.id, mode: 'followers' } })
                    }>
                    <ThemedText type="small" themeColor="textSecondary">
                      {followerCount} {followerCount === 1 ? 'follower' : 'followers'}
                    </ThemedText>
                  </Pressable>
                  <ThemedText type="small" themeColor="textSecondary">
                    ·
                  </ThemedText>
                  <Pressable
                    testID="open-following"
                    hitSlop={6}
                    onPress={() =>
                      router.push({ pathname: '/connections', params: { id: user.id, mode: 'following' } })
                    }>
                    <ThemedText type="small" themeColor="textSecondary">
                      {followingIds.size} following
                    </ThemedText>
                  </Pressable>
                </View>
              )}
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
            <Stat value={String(ranked.length)} label="rated" tint={theme.accent} theme={theme} />
            <Stat
              value={String(concerts.length)}
              label="shows"
              tint={theme.accentAlt}
              theme={theme}
            />
            <Stat
              value={String(streak)}
              label="streak 🔥"
              tint={theme.accent}
              theme={theme}
              onPress={() => router.push('/streak')}
              testID="streak-stat"
            />
          </View>

          <Pressable
            testID="open-wrapped"
            onPress={() => router.push('/wrapped')}
            style={({ pressed }) => [
              styles.wrappedCard,
              { backgroundColor: theme.backgroundElement, opacity: pressed ? 0.7 : 1 },
            ]}>
            <Ionicons name="sparkles" size={18} color={theme.accent} />
            <View style={{ flex: 1 }}>
              <ThemedText type="smallBold">Your Wrapped</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                Live stats — top artists, decades, how you rate
              </ThemedText>
            </View>
            <Ionicons name="chevron-forward" size={18} color={theme.textSecondary} />
          </Pressable>

          <Pressable
            testID="open-achievements"
            onPress={() => router.push('/achievements')}
            style={({ pressed }) => [
              styles.wrappedCard,
              { backgroundColor: theme.backgroundElement, opacity: pressed ? 0.7 : 1 },
            ]}>
            <Ionicons name="ribbon" size={18} color={theme.accentAlt} />
            <View style={{ flex: 1 }}>
              <ThemedText type="smallBold">Badges</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {badges.nextUp
                  ? `${badges.earnedCount} earned · next: ${badges.nextUp.title}`
                  : `All ${badges.total} unlocked 🎉`}
              </ThemedText>
            </View>
            <Ionicons name="chevron-forward" size={18} color={theme.textSecondary} />
          </Pressable>

          <Pressable
            testID="open-activity"
            onPress={() => router.push('/activity')}
            style={({ pressed }) => [
              styles.wrappedCard,
              { backgroundColor: theme.backgroundElement, opacity: pressed ? 0.7 : 1 },
            ]}>
            <Ionicons name="notifications" size={18} color={theme.accent} />
            <View style={{ flex: 1 }}>
              <ThemedText type="smallBold">Activity</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                Hearts on your posts and new followers
              </ThemedText>
            </View>
            <Ionicons name="chevron-forward" size={18} color={theme.textSecondary} />
          </Pressable>

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
                  <ThemedText type="smallBold" style={{ color: theme.accent }}>
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
                        <View style={[styles.removeBadge, { backgroundColor: theme.danger }]}>
                          <Ionicons name="close" size={14} color="#fff" />
                        </View>
                      )}
                    </View>
                    {/* Mockup style: the art speaks — just the score, centered. */}
                    <ThemedText type="smallBold" style={[styles.favScore, { color: theme.accent }]}>
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
                        <ThemedText type="smallBold" style={{ color: theme.accent }}>
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
            RANKED
          </ThemedText>
          {presentTypes.length > 1 && (
            <Segmented
              options={rankOptions}
              value={activeRankFilter}
              onChange={setRankFilter}
              testIDPrefix="rank-filter"
            />
          )}
          {ranked.length === 0 && (
            <EmptyState
              icon="disc-outline"
              doodle="vinyl"
              message="Nothing rated yet."
              ctaLabel="Rate your first album"
              onPressCta={() => router.push('/(tabs)/rate')}
            />
          )}
          {visibleRanked.map((r, i) => (
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
              <ThemedText type="smallBold" style={{ color: theme.accent }}>
                {r.score.toFixed(1)}
              </ThemedText>
            </Pressable>
          ))}

          <ThemedText type="smallBold" themeColor="textSecondary" style={styles.sectionLabel}>
            LIVE SHOWS
          </ThemedText>
          {/* The stage: a fixed dark venue-at-night pocket in every theme. */}
          <View style={styles.stage}>
            {concerts.length === 0 ? (
              <ThemedText type="small" style={[styles.stageEmpty, { color: Stage.textMuted }]}>
                No shows yet — your nights out will live here.
              </ThemedText>
            ) : (
              concerts.map((c) => (
                <View key={c.id} style={styles.stageRow}>
                  <View style={styles.stageMic}>
                    <Ionicons name="mic-outline" size={16} color={Stage.text} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <ThemedText type="smallBold" numberOfLines={1} style={{ color: Stage.text }}>
                      {c.artistName}
                    </ThemedText>
                    <ThemedText type="small" numberOfLines={1} style={{ color: Stage.textMuted }}>
                      {[c.venue, showDateLabel(c.showDate)].filter(Boolean).join(' · ')}
                    </ThemedText>
                  </View>
                  {c.score != null && (
                    <View style={styles.stagePill}>
                      <ThemedText type="smallBold" style={{ color: Stage.onPill, fontSize: 13 }}>
                        {c.score.toFixed(1)}
                      </ThemedText>
                    </View>
                  )}
                </View>
              ))
            )}
            <Pressable
              testID="log-show"
              onPress={() => router.push('/concert/new')}
              style={({ pressed }) => [styles.stageButton, { opacity: pressed ? 0.7 : 1 }]}>
              <Ionicons name="add" size={15} color={Stage.text} />
              <ThemedText type="small" style={{ color: Stage.text }}>
                Log a show
              </ThemedText>
            </Pressable>
          </View>
        </PageContainer>
      </ScrollView>
    </ThemedView>
  );
}

/** Mockup-style stat card: big serif number in an accent tint, quiet label. */
function Stat({
  value,
  label,
  tint,
  theme,
  onPress,
  testID,
}: {
  value: string;
  label: string;
  tint: string;
  theme: ReturnType<typeof useTheme>;
  onPress?: () => void;
  testID?: string;
}) {
  return (
    <Pressable
      testID={testID}
      disabled={!onPress}
      onPress={onPress}
      style={({ pressed }) => [
        styles.stat,
        { backgroundColor: theme.backgroundElement, opacity: pressed ? 0.7 : 1 },
      ]}>
      <ThemedText style={[styles.statValue, { color: tint }]}>{value}</ThemedText>
      <ThemedText type="small" themeColor="textSecondary" style={styles.statLabel}>
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
  avatarInitial: { fontFamily: DisplayFont, fontSize: 18 },
  displayName: { fontFamily: DisplayFont, fontSize: 19 },
  connections: { flexDirection: 'row', gap: Spacing.two, marginTop: 2 },
  settingsBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  stats: { flexDirection: 'row', gap: Spacing.two },
  stat: { flex: 1, alignItems: 'center', paddingVertical: Spacing.three, borderRadius: 12, gap: 2 },
  statValue: { fontFamily: DisplayFont, fontSize: 24, lineHeight: 30 },
  statLabel: { fontSize: 11, letterSpacing: 0.6 },
  wrappedCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    borderRadius: 12,
    padding: Spacing.three,
  },
  sectionLabel: { marginTop: Spacing.two, fontSize: 12, letterSpacing: 1.1 },
  top4Header: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
  },
  favorites: { flexDirection: 'row', gap: Spacing.two },
  favorite: { flex: 1, gap: 4 },
  favScore: { textAlign: 'center', marginTop: 2 },
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
  stage: {
    backgroundColor: Stage.background,
    borderRadius: 14,
    padding: Spacing.three,
    gap: Spacing.three,
  },
  stageEmpty: { textAlign: 'center', paddingVertical: Spacing.two },
  stageRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  stageMic: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: Stage.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stagePill: {
    backgroundColor: Stage.pill,
    borderRadius: 999,
    paddingHorizontal: Spacing.two,
    paddingVertical: 3,
    minWidth: 38,
    alignItems: 'center',
  },
  stageButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.one,
    borderWidth: 1,
    borderColor: Stage.line,
    borderRadius: 999,
    paddingVertical: Spacing.two,
  },
});
