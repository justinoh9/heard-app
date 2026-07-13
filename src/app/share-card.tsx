import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, View } from 'react-native';

import { useAuthGate } from '@/auth/use-require-auth';
import { ShareCard, type ShareCardData } from '@/components/share-card';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useToast } from '@/components/toast';
import { useConcerts } from '@/concerts/store';
import { Spacing } from '@/constants/theme';
import { computeStats } from '@/data/stats';
import { useRatings } from '@/data/store';
import { useTheme } from '@/hooks/use-theme';
import { shareCard } from '@/share/export';
import { useSocial } from '@/social/store';

/**
 * Share-card preview + export (ROADMAP Phase 3). Renders the branded card and
 * hands it to `shareCard` (native share sheet / web download). Reached from the
 * Wrapped screen's share action.
 */
export default function ShareCardModal() {
  const theme = useTheme();
  const router = useRouter();
  const toast = useToast();
  const user = useAuthGate();
  const { ranked } = useRatings();
  const { concerts } = useConcerts();
  const { myProfile } = useSocial();
  const cardRef = useRef<View>(null);
  const [busy, setBusy] = useState(false);

  if (!user) return null;

  const stats = computeStats(ranked, concerts);
  const data: ShareCardData = {
    name: user.displayName,
    handle: myProfile?.handle,
    ratedCount: stats.ratedCount,
    meanScore: stats.meanScore,
    concertCount: stats.concertCount,
    topArtist: stats.topArtists[0]?.name,
    highest: stats.highest
      ? {
          title: stats.highest.item.title,
          artist: stats.highest.item.artist,
          artUrl: stats.highest.item.artUrl,
          score: stats.highest.score,
        }
      : undefined,
  };

  async function onShare() {
    if (busy) return;
    setBusy(true);
    try {
      await shareCard(cardRef.current, `jelli-${myProfile?.handle ?? 'card'}`);
      if (Platform.OS === 'web') toast('Image saved', '📸');
    } catch (e) {
      console.warn('[share-card] export failed:', e);
      toast('Could not export the card', '⚠️');
    } finally {
      setBusy(false);
    }
  }

  const actionLabel = Platform.OS === 'web' ? 'Save image' : 'Share';

  return (
    <ThemedView style={styles.screen}>
      <Pressable
        onPress={() => router.back()}
        accessibilityLabel="Close"
        hitSlop={8}
        style={styles.close}>
        <Ionicons name="close" size={28} color={theme.text} />
      </Pressable>

      <View style={styles.body}>
        <ShareCard ref={cardRef} data={data} />

        <Pressable
          testID="share-card-action"
          onPress={onShare}
          style={({ pressed }) => [
            styles.button,
            { backgroundColor: theme.accent, opacity: pressed || busy ? 0.7 : 1 },
          ]}>
          {busy ? (
            <ActivityIndicator color={theme.onAccent} />
          ) : (
            <>
              <Ionicons name="share-outline" size={18} color={theme.onAccent} />
              <ThemedText type="smallBold" style={{ color: theme.onAccent }}>
                {actionLabel}
              </ThemedText>
            </>
          )}
        </Pressable>
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  close: { alignSelf: 'flex-end', padding: Spacing.three },
  body: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.four },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.five,
    borderRadius: 12,
  },
});
