import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { useAuth } from '@/auth/store';
import { ConcertMap } from '@/components/concert-map';
import { EmptyState } from '@/components/empty-state';
import { GuestGate } from '@/components/guest-gate';
import { PageContainer } from '@/components/page-container';
import { Segmented } from '@/components/segmented';
import { Surface } from '@/components/surface';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { attendedFor, confirmedAttendees, invitesFor, wishlistFor } from '@/concerts/rows';
import { useConcerts } from '@/concerts/store';
import type { Concert } from '@/concerts/types';
import { Spacing } from '@/constants/theme';
import { useHaptics } from '@/hooks/use-haptics';
import { useTheme } from '@/hooks/use-theme';
import { useSocial } from '@/social/store';

type Tab = 'attended' | 'wishlist' | 'invites';

/**
 * The live-music home (ROADMAP Phase 3, Concert layer v2). Splits the viewer's
 * shows into what they've been to, what they want to go to, and pending tag
 * invitations to confirm or decline. Logging + wishlist add both route to the
 * concert/new modal.
 */
export default function ConcertsScreen() {
  const theme = useTheme();
  const router = useRouter();
  const haptics = useHaptics();
  const { status } = useAuth();
  const { user } = useAuth();
  const { concerts, confirmTag, declineTag, markAttended, removeConcert } = useConcerts();
  const { people } = useSocial();
  const [tab, setTab] = useState<Tab>('attended');

  const nameOf = useMemo(
    () => new Map(people.map((p) => [p.userId, p.displayName])),
    [people],
  );

  const uid = user?.id ?? '';
  const attended = attendedFor(uid, concerts);
  const wishlist = wishlistFor(uid, concerts);
  const invites = invitesFor(uid, concerts);

  if (status !== 'authed') {
    return (
      <GuestGate
        icon="mic-outline"
        title="Concerts"
        message="Sign in to log the shows you've been to and track the ones you want to see."
      />
    );
  }

  const list = tab === 'attended' ? attended : tab === 'wishlist' ? wishlist : invites;

  return (
    <ThemedView style={styles.screen}>
      <View style={styles.topBar}>
        <Pressable
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/profile'))}
          accessibilityLabel="Back"
          hitSlop={8}>
          <Ionicons name="chevron-back" size={26} color={theme.text} />
        </Pressable>
        <ThemedText type="smallBold">Concerts</ThemedText>
        <Pressable
          testID="log-show"
          onPress={() => router.push('/concert/new')}
          accessibilityLabel="Log a show"
          hitSlop={8}>
          <Ionicons name="add" size={26} color={theme.accent} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <PageContainer style={styles.inner}>
          <Segmented
            options={[
              { key: 'attended', label: `Attended ${attended.length || ''}`.trim() },
              { key: 'wishlist', label: `Want to go ${wishlist.length || ''}`.trim() },
              {
                key: 'invites',
                label: invites.length > 0 ? `Invites ${invites.length}` : 'Invites',
              },
            ]}
            value={tab}
            onChange={(v) => setTab(v as Tab)}
            testIDPrefix="concerts-tab"
          />

          {/* The wedge: where you've been. Only over attended shows — a
              wishlist isn't a place you've stood, and invites aren't yours yet.
              Hidden on the empty list, where EmptyState already says its piece. */}
          {tab === 'attended' && attended.length > 0 && <ConcertMap concerts={attended} />}

          {tab === 'wishlist' && (
            <Pressable
              testID="add-wishlist"
              onPress={() => router.push({ pathname: '/concert/new', params: { wishlist: '1' } })}
              style={({ pressed }) => [
                styles.addWish,
                { borderColor: theme.accent, opacity: pressed ? 0.6 : 1 },
              ]}>
              <Ionicons name="add-circle-outline" size={18} color={theme.accent} />
              <ThemedText type="smallBold" style={{ color: theme.accent }}>
                Add a show you want to see
              </ThemedText>
            </Pressable>
          )}

          {list.length === 0 ? (
            <EmptyState
              icon={tab === 'invites' ? 'mail-outline' : 'mic-outline'}
              doodle={tab === 'invites' ? undefined : 'mic'}
              message={
                tab === 'attended'
                  ? 'No shows yet — log a concert to start your live-music map.'
                  : tab === 'wishlist'
                    ? 'Nothing on your wishlist yet. Add a show you want to see.'
                    : 'No pending invites. When a friend tags you at a show, it lands here.'
              }
              ctaLabel={tab === 'attended' ? 'Log a show' : undefined}
              onPressCta={tab === 'attended' ? () => router.push('/concert/new') : undefined}
            />
          ) : (
            list.map((c) => (
              <ConcertRow
                key={c.id}
                concert={c}
                tab={tab}
                taggerName={nameOf.get(c.userId)}
                attendeeNames={confirmedAttendees(c)
                  .map((id) => nameOf.get(id))
                  .filter((n): n is string => !!n)}
                onConfirm={() => {
                  haptics.success();
                  confirmTag(c.id);
                }}
                onDecline={() => declineTag(c.id)}
                onMarkAttended={() => {
                  haptics.success();
                  markAttended(c.id);
                }}
                onRemove={() => removeConcert(c.id)}
              />
            ))
          )}
        </PageContainer>
      </ScrollView>
    </ThemedView>
  );
}

function ConcertRow({
  concert,
  tab,
  taggerName,
  attendeeNames,
  onConfirm,
  onDecline,
  onMarkAttended,
  onRemove,
}: {
  concert: Concert;
  tab: Tab;
  taggerName?: string;
  attendeeNames: string[];
  onConfirm: () => void;
  onDecline: () => void;
  onMarkAttended: () => void;
  onRemove: () => void;
}) {
  const theme = useTheme();
  const where = [concert.venue, concert.city].filter(Boolean).join(' · ');

  return (
    <Surface style={styles.row}>
      <View style={[styles.icon, { backgroundColor: theme.backgroundSelected }]}>
        <Ionicons name="musical-notes" size={20} color={theme.accent} />
      </View>
      <View style={styles.rowText}>
        <ThemedText type="smallBold" numberOfLines={1}>
          {concert.artistName}
        </ThemedText>
        {where ? (
          <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
            {where}
          </ThemedText>
        ) : null}
        <ThemedText type="small" themeColor="textSecondary">
          {concert.showDate}
          {concert.score != null ? ` · ${concert.score.toFixed(1)}` : ''}
        </ThemedText>

        {tab === 'invites' && (
          <ThemedText type="small" themeColor="textSecondary">
            {taggerName ? `${taggerName} tagged you` : 'You were tagged'}
          </ThemedText>
        )}
        {tab === 'attended' && attendeeNames.length > 0 && (
          <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
            with {attendeeNames.join(', ')}
          </ThemedText>
        )}

        {tab === 'invites' && (
          <View style={styles.actions}>
            <Pressable
              testID={`confirm-${concert.id}`}
              onPress={onConfirm}
              style={({ pressed }) => [
                styles.pill,
                { backgroundColor: theme.accent, opacity: pressed ? 0.7 : 1 },
              ]}>
              <ThemedText type="smallBold" style={{ color: theme.onAccent }}>
                I was there
              </ThemedText>
            </Pressable>
            <Pressable
              testID={`decline-${concert.id}`}
              onPress={onDecline}
              style={({ pressed }) => [
                styles.pill,
                { backgroundColor: theme.backgroundElement, opacity: pressed ? 0.7 : 1 },
              ]}>
              <ThemedText type="smallBold" themeColor="textSecondary">
                No
              </ThemedText>
            </Pressable>
          </View>
        )}
        {tab === 'wishlist' && (
          <View style={styles.actions}>
            <Pressable
              testID={`attended-${concert.id}`}
              onPress={onMarkAttended}
              style={({ pressed }) => [
                styles.pill,
                { backgroundColor: theme.accent, opacity: pressed ? 0.7 : 1 },
              ]}>
              <ThemedText type="smallBold" style={{ color: theme.onAccent }}>
                I went
              </ThemedText>
            </Pressable>
            <Pressable
              testID={`remove-${concert.id}`}
              onPress={onRemove}
              accessibilityLabel="Remove from wishlist"
              hitSlop={8}
              style={({ pressed }) => [styles.iconBtn, { opacity: pressed ? 0.6 : 1 }]}>
              <Ionicons name="trash-outline" size={16} color={theme.textSecondary} />
            </Pressable>
          </View>
        )}
      </View>
    </Surface>
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
  addWish: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderRadius: 12,
    paddingVertical: Spacing.three,
  },
  row: { flexDirection: 'row', gap: Spacing.three, alignItems: 'flex-start' },
  icon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  rowText: { flex: 1, gap: 2 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, marginTop: Spacing.two },
  pill: { borderRadius: 999, paddingHorizontal: Spacing.three, paddingVertical: 6 },
  iconBtn: { padding: 4 },
});
