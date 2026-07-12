import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { useAuthGate } from '@/auth/use-require-auth';
import { AlbumCover } from '@/components/album-cover';
import { ModalDialogFrame } from '@/components/modal-dialog-frame';
import { TextField } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { useToast } from '@/components/toast';
import { Spacing } from '@/constants/theme';
import { useHaptics } from '@/hooks/use-haptics';
import { useTheme } from '@/hooks/use-theme';
import type { ItemType } from '@/ranking/types';
import { useSocial } from '@/social/store';
import type { SocialEventType } from '@/social/types';

/**
 * Repost composer (ROADMAP F4). Reshares another user's rating/drop/concert
 * into the viewer's own feed with an optional note, emitting a 'repost' feed
 * event whose payload denormalizes the original content + attribution. Reached
 * from the Repost action on a feed card.
 */
export default function RepostModal() {
  const theme = useTheme();
  const router = useRouter();
  const haptics = useHaptics();
  const toast = useToast();
  const user = useAuthGate();
  const { publish } = useSocial();
  const params = useLocalSearchParams<{
    originalUserId?: string;
    originalDisplayName?: string;
    originalType?: string;
    title?: string;
    artist?: string;
    artUrl?: string;
    score?: string;
    review?: string;
    itemId?: string;
    itemType?: string;
  }>();

  const [note, setNote] = useState('');

  const title = String(params.title ?? '');
  const artist = params.artist || undefined;
  const artUrl = params.artUrl || undefined;
  const scoreNum = params.score ? Number.parseFloat(String(params.score)) : undefined;
  const originalName = params.originalDisplayName || 'Someone';

  function submit() {
    haptics.success();
    publish('repost', {
      originalUserId: params.originalUserId || undefined,
      originalDisplayName: originalName,
      originalType: (params.originalType as SocialEventType) || 'rated',
      title,
      artist,
      artUrl,
      score: Number.isFinite(scoreNum) ? scoreNum : undefined,
      review: params.review || undefined,
      itemId: params.itemId || undefined,
      itemType: (params.itemType as ItemType) || undefined,
      note: note.trim() || undefined,
    });
    router.back();
    toast('Reposted to your feed', '🔁');
  }

  if (!user) return null;

  return (
    <ModalDialogFrame>
      <View style={styles.topBar}>
        <Pressable onPress={() => router.back()} accessibilityLabel="Close" hitSlop={8}>
          <Ionicons name="close" size={26} color={theme.text} />
        </Pressable>
        <ThemedText type="smallBold">Repost</ThemedText>
        <View style={{ width: 26 }} />
      </View>

      <View style={styles.body}>
        <ThemedText type="small" themeColor="textSecondary" style={styles.center}>
          Resharing {originalName}&apos;s {params.originalType === 'concert' ? 'show' : params.originalType === 'drop' ? 'drop' : 'rating'}
        </ThemedText>

        <View style={[styles.preview, { backgroundColor: theme.backgroundElement }]}>
          <AlbumCover uri={artUrl} size={56} radius={8} />
          <View style={{ flex: 1 }}>
            <ThemedText type="smallBold" numberOfLines={1}>
              {title}
            </ThemedText>
            {artist ? (
              <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
                {artist}
              </ThemedText>
            ) : null}
            {Number.isFinite(scoreNum) ? (
              <ThemedText type="small" style={{ color: theme.accent }}>
                {scoreNum!.toFixed(1)}
              </ThemedText>
            ) : null}
          </View>
        </View>

        <TextField
          testID="repost-note"
          label="Add a note (optional)"
          value={note}
          onChangeText={setNote}
          placeholder="Say why you're resharing…"
          multiline
          maxLength={500}
          style={styles.noteInput}
        />

        <Pressable
          testID="repost-submit"
          onPress={submit}
          style={({ pressed }) => [
            styles.primary,
            { backgroundColor: theme.accent, opacity: pressed ? 0.7 : 1 },
          ]}>
          <ThemedText type="smallBold" style={{ color: theme.onAccent }}>
            Repost
          </ThemedText>
        </Pressable>
      </View>
    </ModalDialogFrame>
  );
}

const styles = StyleSheet.create({
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing.three,
  },
  body: { flex: 1, gap: Spacing.three, padding: Spacing.four },
  center: { textAlign: 'center' },
  preview: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    padding: Spacing.three,
    borderRadius: 12,
  },
  noteInput: { minHeight: 80, textAlignVertical: 'top' },
  primary: {
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.five,
    borderRadius: 12,
    alignItems: 'center',
  },
});
