import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { ModalDialogFrame } from '@/components/modal-dialog-frame';
import { ScoreInput } from '@/components/score-input';
import { TextField } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { useConcerts } from '@/concerts/store';
import { Spacing } from '@/constants/theme';
import { useHaptics } from '@/hooks/use-haptics';
import { useTheme } from '@/hooks/use-theme';
import { useSocial } from '@/social/store';
import { todayKey } from '@/streaks/logic';

/**
 * Log a live show (blueprint §2.C): artist + venue + date + a performance
 * score, and tag the friends who were there — the show lands on their
 * profiles too. Kept as one scrollable modal; every field except artist is
 * optional so logging stays fast.
 */
export default function NewConcertModal() {
  const theme = useTheme();
  const router = useRouter();
  const haptics = useHaptics();
  const { logConcert } = useConcerts();
  const { people, followingIds } = useSocial();

  const [artistName, setArtistName] = useState('');
  const [venue, setVenue] = useState('');
  const [city, setCity] = useState('');
  const [showDate, setShowDate] = useState(todayKey());
  const [score, setScore] = useState(8);
  const [notes, setNotes] = useState('');
  const [tagged, setTagged] = useState<Set<string>>(new Set());

  // People you follow first — they're who you most likely went with.
  const taggable = [...people].sort(
    (a, b) => Number(followingIds.has(b.userId)) - Number(followingIds.has(a.userId)),
  );

  const dateOk = /^\d{4}-\d{2}-\d{2}$/.test(showDate.trim());
  const canSave = artistName.trim().length > 0 && dateOk;

  function toggleTag(userId: string) {
    setTagged((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  }

  function save() {
    if (!canSave) return;
    haptics.success();
    logConcert({
      artistName: artistName.trim(),
      venue: venue.trim() || undefined,
      city: city.trim() || undefined,
      showDate: showDate.trim(),
      score,
      notes: notes.trim() || undefined,
      taggedUserIds: [...tagged],
    });
    router.back();
  }

  return (
    <ModalDialogFrame>
      <View style={styles.topBar}>
        <Pressable onPress={() => router.back()} accessibilityLabel="Close" hitSlop={8}>
          <Ionicons name="close" size={26} color={theme.text} />
        </Pressable>
        <ThemedText type="smallBold">Log a show</ThemedText>
        <View style={{ width: 26 }} />
      </View>

      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        <TextField
          testID="concert-artist"
          label="Artist"
          value={artistName}
          onChangeText={setArtistName}
          placeholder="Who did you see?"
        />
        <View style={styles.row}>
          <View style={{ flex: 1 }}>
            <TextField
              testID="concert-venue"
              label="Venue"
              value={venue}
              onChangeText={setVenue}
              placeholder="Where?"
            />
          </View>
          <View style={{ flex: 1 }}>
            <TextField
              testID="concert-city"
              label="City"
              value={city}
              onChangeText={setCity}
              placeholder="Optional"
            />
          </View>
        </View>
        <TextField
          testID="concert-date"
          label="Date"
          value={showDate}
          onChangeText={setShowDate}
          placeholder="YYYY-MM-DD"
        />
        {!dateOk && showDate.trim().length > 0 && (
          <ThemedText type="small" style={styles.error}>
            Use YYYY-MM-DD, e.g. {todayKey()}
          </ThemedText>
        )}

        <ThemedText type="smallBold" themeColor="textSecondary">
          HOW WAS THE PERFORMANCE?
        </ThemedText>
        <ScoreInput value={score} onChange={setScore} />

        {taggable.length > 0 && (
          <>
            <ThemedText type="smallBold" themeColor="textSecondary">
              WHO WAS THERE?
            </ThemedText>
            <View style={styles.chips}>
              {taggable.map((p) => {
                const on = tagged.has(p.userId);
                return (
                  <Pressable
                    key={p.userId}
                    testID={`tag-${p.userId}`}
                    onPress={() => toggleTag(p.userId)}
                    accessibilityLabel={on ? `Untag ${p.displayName}` : `Tag ${p.displayName}`}
                    style={[
                      styles.chip,
                      { backgroundColor: on ? '#1D9E75' : theme.backgroundElement },
                    ]}>
                    <ThemedText
                      type="small"
                      style={{ color: on ? '#fff' : theme.textSecondary }}>
                      {p.displayName}
                    </ThemedText>
                  </Pressable>
                );
              })}
            </View>
          </>
        )}

        <TextField
          testID="concert-notes"
          label="Notes (optional)"
          value={notes}
          onChangeText={setNotes}
          placeholder="Openers, setlist highlights…"
          multiline
          maxLength={500}
        />

        <Pressable
          testID="concert-save"
          onPress={save}
          disabled={!canSave}
          style={({ pressed }) => [
            styles.primary,
            { opacity: !canSave ? 0.4 : pressed ? 0.7 : 1 },
          ]}>
          <ThemedText type="smallBold" style={{ color: '#fff' }}>
            Log show
          </ThemedText>
        </Pressable>
      </ScrollView>
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
  body: { gap: Spacing.three, padding: Spacing.four },
  row: { flexDirection: 'row', gap: Spacing.three },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  chip: { paddingVertical: 6, paddingHorizontal: Spacing.three, borderRadius: 999 },
  error: { color: '#E24B4A' },
  primary: {
    backgroundColor: '#1D9E75',
    paddingVertical: Spacing.three,
    borderRadius: 12,
    alignItems: 'center',
  },
});
