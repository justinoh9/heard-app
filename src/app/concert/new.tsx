import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { useAuthGate } from '@/auth/use-require-auth';
import { ModalDialogFrame } from '@/components/modal-dialog-frame';
import { ScoreInput } from '@/components/score-input';
import { TextField } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import type { VenueSuggestion } from '@/concerts/geocode';
import { venueGeocoder } from '@/concerts/provider';
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
  useAuthGate(); // logging a show needs an account — bounce guests to sign-in

  // Wishlist mode ("want to go") drops the score + tag steps — it's a plan, not
  // a review of something that happened.
  const params = useLocalSearchParams<{ wishlist?: string }>();
  const isWishlist = params.wishlist === '1';

  const [artistName, setArtistName] = useState('');
  const [venue, setVenue] = useState('');
  const [city, setCity] = useState('');
  const [showDate, setShowDate] = useState(todayKey());
  const [score, setScore] = useState(8);
  const [notes, setNotes] = useState('');
  const [tagged, setTagged] = useState<Set<string>>(new Set());

  // Venue autocomplete → the coordinates that put this show on the map.
  // `coords` is only ever set by picking a suggestion: a hand-typed venue is
  // still perfectly loggable, it just doesn't get a dot.
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [suggestions, setSuggestions] = useState<VenueSuggestion[]>([]);
  /** True right after a pick, so the dropdown doesn't reopen over its own answer. */
  const [picked, setPicked] = useState(false);

  useEffect(() => {
    const q = venue.trim();
    if (picked || q.length < 3) {
      setSuggestions([]);
      return;
    }
    let cancelled = false;
    const controller = new AbortController();
    // Debounced so typing a venue name is one request, not fifteen — Photon is
    // a free community service and we're a guest on it.
    const timer = setTimeout(() => {
      venueGeocoder.search(q, controller.signal).then((results) => {
        if (!cancelled) setSuggestions(results);
      });
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(timer);
      controller.abort();
    };
  }, [venue, picked]);

  function changeVenue(text: string) {
    setVenue(text);
    setPicked(false);
    // The old coordinates described the old text — keeping them would pin the
    // show to a venue the user just edited away from.
    setCoords(null);
  }

  function pickVenue(s: VenueSuggestion) {
    setVenue(s.name);
    if (s.city) setCity(s.city);
    setCoords({ lat: s.lat, lng: s.lng });
    setPicked(true);
    setSuggestions([]);
  }

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
      lat: coords?.lat,
      lng: coords?.lng,
      showDate: showDate.trim(),
      score: isWishlist ? undefined : score,
      notes: notes.trim() || undefined,
      status: isWishlist ? 'wishlist' : 'attended',
      taggedUserIds: isWishlist ? [] : [...tagged],
    });
    router.back();
  }

  return (
    <ModalDialogFrame>
      <View style={styles.topBar}>
        <Pressable onPress={() => router.back()} accessibilityLabel="Close" hitSlop={8}>
          <Ionicons name="close" size={26} color={theme.text} />
        </Pressable>
        <ThemedText type="smallBold">{isWishlist ? 'Want to go' : 'Log a show'}</ThemedText>
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
              onChangeText={changeVenue}
              placeholder="Where?"
              autoCorrect={false}
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

        {suggestions.length > 0 && (
          <View
            testID="venue-suggestions"
            style={[styles.suggestions, { backgroundColor: theme.backgroundElement }]}>
            {suggestions.map((s) => (
              <Pressable
                key={s.id}
                testID={`venue-${s.id}`}
                onPress={() => pickVenue(s)}
                style={({ pressed }) => [
                  styles.suggestion,
                  { opacity: pressed ? 0.6 : 1 },
                ]}>
                <Ionicons name="location-outline" size={16} color={theme.textSecondary} />
                <View style={styles.suggestionText}>
                  <ThemedText type="small" numberOfLines={1}>
                    {s.name}
                  </ThemedText>
                  {s.label ? (
                    <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
                      {s.label}
                    </ThemedText>
                  ) : null}
                </View>
              </Pressable>
            ))}
          </View>
        )}

        {/* Teaches the mechanic: picking a suggestion is what earns the dot. */}
        {coords && (
          <View style={styles.pinned}>
            <Ionicons name="location" size={14} color={theme.accent} />
            <ThemedText type="small" style={{ color: theme.accent }}>
              This show will appear on your map
            </ThemedText>
          </View>
        )}
        <TextField
          testID="concert-date"
          label={isWishlist ? 'When (if known)' : 'Date'}
          value={showDate}
          onChangeText={setShowDate}
          placeholder="YYYY-MM-DD"
        />
        {!dateOk && showDate.trim().length > 0 && (
          <ThemedText type="small" style={[styles.error, { color: theme.danger }]}>
            Use YYYY-MM-DD, e.g. {todayKey()}
          </ThemedText>
        )}

        {!isWishlist && (
          <>
            <ThemedText type="smallBold" themeColor="textSecondary">
              HOW WAS THE PERFORMANCE?
            </ThemedText>
            <ScoreInput value={score} onChange={setScore} />
          </>
        )}

        {!isWishlist && taggable.length > 0 && (
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
                      { backgroundColor: on ? theme.accent : theme.backgroundElement },
                    ]}>
                    <ThemedText
                      type="small"
                      style={{ color: on ? theme.onAccent : theme.textSecondary }}>
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
            { backgroundColor: theme.accent, opacity: !canSave ? 0.4 : pressed ? 0.7 : 1 },
          ]}>
          <ThemedText type="smallBold" style={{ color: theme.onAccent }}>
            {isWishlist ? 'Add to wishlist' : 'Log show'}
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
  suggestions: { borderRadius: 12, overflow: 'hidden' },
  suggestion: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
  },
  suggestionText: { flex: 1 },
  pinned: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  chip: { paddingVertical: 6, paddingHorizontal: Spacing.three, borderRadius: 999 },
  error: {},
  primary: {
    paddingVertical: Spacing.three,
    borderRadius: 12,
    alignItems: 'center',
  },
});
