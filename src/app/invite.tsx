import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, ScrollView, Share, StyleSheet, TextInput, View } from 'react-native';

import { useAnalytics } from '@/analytics/store';
import { useAuth } from '@/auth/store';
import { GuestGate } from '@/components/guest-gate';
import { PageContainer } from '@/components/page-container';
import { Surface } from '@/components/surface';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useToast } from '@/components/toast';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { invitesBackend } from '@/invites/provider';
import type { Invite } from '@/invites/types';
import { useSocial } from '@/social/store';

/**
 * Invites (ROADMAP Phase 4 / F6), reached from the Profile.
 *
 * Two jobs on one screen: hand out your codes, and redeem one you were given.
 * They're together because they're the same idea seen from either end, and a
 * separate "redeem" route would be a page nobody could find without the link
 * that already contains the code.
 *
 * The link form is /invite?code=ABC123 — arriving through it prefills the box, so
 * the common path is: tap friend's link → sign up → tap Join.
 */

const SITE = 'https://myjelli.site';

export default function InviteScreen() {
  const theme = useTheme();
  const router = useRouter();
  const toast = useToast();
  const { status } = useAuth();
  const { myProfile, refresh } = useSocial();
  const { track } = useAnalytics();
  const { code: codeParam } = useLocalSearchParams<{ code?: string }>();

  const [invites, setInvites] = useState<Invite[] | null>(null);
  const [entry, setEntry] = useState(codeParam ?? '');
  const [redeeming, setRedeeming] = useState(false);
  const [redeemed, setRedeemed] = useState(false);

  useEffect(() => {
    if (status !== 'authed') return;
    let cancelled = false;
    invitesBackend
      .mine()
      .then((list) => {
        if (!cancelled) setInvites(list);
      })
      .catch((e: unknown) => {
        console.warn('[invite] load failed:', e);
        if (!cancelled) setInvites([]);
      });
    return () => {
      cancelled = true;
    };
  }, [status]);

  const linkFor = useCallback((code: string) => `${SITE}/invite?code=${code}`, []);

  const shareCode = useCallback(
    async (code: string) => {
      const url = linkFor(code);
      const message = `Come rank music with me on Jelli — ${url}`;
      // Web uses the platform clipboard directly rather than expo-clipboard: one
      // copy button is not worth a native dependency, and adding one would force
      // anyone with a native build to rebuild to get this screen.
      if (Platform.OS === 'web') {
        try {
          await navigator.clipboard.writeText(url);
          toast('Invite link copied', '🔗');
        } catch {
          // Clipboard access needs a secure context and can be refused. Showing
          // the link beats silently doing nothing — they can still select it.
          toast(url, '🔗');
        }
        return;
      }
      try {
        await Share.share({ message });
      } catch (e: unknown) {
        console.warn('[invite] share failed:', e);
      }
    },
    [linkFor, toast],
  );

  const redeem = useCallback(async () => {
    const code = entry.trim();
    if (!code || redeeming) return;
    setRedeeming(true);
    try {
      const inviter = await invitesBackend.redeem(code);
      if (!inviter) {
        // One message for every failure — the backend deliberately doesn't tell
        // us which one it was, so guessing here would be inventing detail.
        toast("That code didn't work", '🤔');
        return;
      }
      setRedeemed(true);
      setEntry('');
      // The redemption made a mutual follow server-side; pull it in so the feed
      // isn't empty by the time they get there, which is the entire point.
      refresh();
      track('followed');
      toast("You're connected — their activity is in your feed", '🎉');
    } catch (e: unknown) {
      console.warn('[invite] redeem failed:', e);
      toast('Could not check that code', '⚠️');
    } finally {
      setRedeeming(false);
    }
  }, [entry, redeeming, refresh, toast, track]);

  if (status !== 'authed') {
    return (
      <GuestGate
        icon="gift-outline"
        title="Invites"
        message="Sign in to share your invite links — or to use one you were given."
      />
    );
  }

  const unused = (invites ?? []).filter((i) => !i.redeemedAt);
  const used = (invites ?? []).filter((i) => i.redeemedAt);

  return (
    <ThemedView style={styles.screen}>
      <View style={styles.topBar}>
        <Pressable
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/profile'))}
          accessibilityLabel="Back"
          hitSlop={8}>
          <Ionicons name="chevron-back" size={26} color={theme.text} />
        </Pressable>
        <ThemedText type="smallBold">Invites</ThemedText>
        <View style={{ width: 26 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <PageContainer style={styles.inner}>
          <ThemedText type="subtitle">Bring someone in</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            Jelli is better with people you actually know. Anyone who joins through your link
            follows you and you follow them back straight away — so neither of you starts with an
            empty feed.
          </ThemedText>

          {invites === null ? (
            <ActivityIndicator color={theme.accent} />
          ) : (
            <>
              <ThemedText type="smallBold" themeColor="textSecondary">
                {unused.length} INVITE{unused.length === 1 ? '' : 'S'} LEFT
              </ThemedText>
              {unused.map((i) => (
                <Surface key={i.code} style={styles.row}>
                  <ThemedText type="smallBold" style={styles.code}>
                    {i.code}
                  </ThemedText>
                  <Pressable
                    onPress={() => shareCode(i.code)}
                    accessibilityRole="button"
                    accessibilityLabel={`Share invite code ${i.code}`}
                    style={({ pressed }) => [
                      styles.pill,
                      { backgroundColor: theme.accent, opacity: pressed ? 0.7 : 1 },
                    ]}>
                    <ThemedText type="smallBold" style={{ color: theme.onAccent }}>
                      {Platform.OS === 'web' ? 'Copy link' : 'Share'}
                    </ThemedText>
                  </Pressable>
                </Surface>
              ))}

              {used.length > 0 ? (
                <>
                  <ThemedText type="smallBold" themeColor="textSecondary">
                    USED
                  </ThemedText>
                  {used.map((i) => (
                    <Surface key={i.code} style={styles.row}>
                      <ThemedText type="smallBold" themeColor="textSecondary" style={styles.code}>
                        {i.code}
                      </ThemedText>
                      <ThemedText type="small" themeColor="textSecondary">
                        Joined 🎉
                      </ThemedText>
                    </Surface>
                  ))}
                </>
              ) : null}
            </>
          )}

          {/*
            Hidden once used: redemption is once per account (the DB enforces it),
            so leaving the box on screen would be an invitation to be told no.
          */}
          {!redeemed ? (
            <View style={styles.redeem}>
              <ThemedText type="smallBold">Got a code?</ThemedText>
              <View style={[styles.entryRow, { borderColor: theme.backgroundSelected }]}>
                <TextInput
                  value={entry}
                  onChangeText={setEntry}
                  placeholder="ABC123"
                  placeholderTextColor={theme.textSecondary}
                  autoCapitalize="characters"
                  autoCorrect={false}
                  maxLength={12}
                  accessibilityLabel="Invite code"
                  style={[styles.entry, { color: theme.text }]}
                />
                <Pressable
                  onPress={redeem}
                  disabled={!entry.trim() || redeeming}
                  accessibilityRole="button"
                  accessibilityLabel="Use this invite code"
                  style={({ pressed }) => [
                    styles.pill,
                    {
                      backgroundColor: entry.trim() ? theme.accent : theme.backgroundSelected,
                      opacity: pressed ? 0.7 : 1,
                    },
                  ]}>
                  {redeeming ? (
                    <ActivityIndicator color={theme.onAccent} />
                  ) : (
                    <ThemedText
                      type="smallBold"
                      style={{ color: entry.trim() ? theme.onAccent : theme.textSecondary }}>
                      Join
                    </ThemedText>
                  )}
                </Pressable>
              </View>
              <ThemedText type="small" themeColor="textSecondary">
                You can use one code, once — it connects you to whoever sent it.
              </ThemedText>
            </View>
          ) : null}
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
  content: { padding: Spacing.three, paddingBottom: Spacing.six },
  inner: { gap: Spacing.three },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  code: { fontSize: 18, letterSpacing: 2 },
  pill: {
    borderRadius: 999,
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.two,
    minWidth: 96,
    alignItems: 'center',
  },
  redeem: { gap: Spacing.two, marginTop: Spacing.three },
  entryRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, borderWidth: 1, borderRadius: 999, paddingLeft: Spacing.three, paddingRight: 4, paddingVertical: 4 },
  entry: { flex: 1, fontSize: 16, letterSpacing: 2, outlineStyle: 'none' } as object,
});
