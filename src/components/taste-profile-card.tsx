/**
 * The taste-profile "who you are" card (ROADMAP Phase 2). Renders a rating-style
 * chip + blurb, mean score, favorite decade, and most-logged-artist chips from
 * a computed TasteProfile. Reused on the viewer's own profile and on another
 * user's profile (/user/[id]). Palette-driven — no hardcoded accents.
 */

import { StyleSheet, View } from 'react-native';

import { Surface } from '@/components/surface';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { TasteProfile } from '@/taste/profile';

export function TasteProfileCard({
  profile,
  /** "You" on your own profile, the name on someone else's — drives the blurb. */
  self = true,
  name,
}: {
  profile: TasteProfile;
  self?: boolean;
  name?: string;
}) {
  const theme = useTheme();
  const { style, meanScore, topDecade, topArtists, ratedCount } = profile;

  // Nothing rated: a gentle prompt rather than an empty card.
  if (ratedCount === 0) {
    return (
      <Surface style={styles.card}>
        <ThemedText type="smallBold" themeColor="textSecondary" style={styles.label}>
          TASTE
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {self ? 'Rate a few albums to reveal your taste profile.' : `${name ?? 'They'} hasn’t rated enough yet.`}
        </ThemedText>
      </Surface>
    );
  }

  const who = self ? 'You use' : `${name ?? 'They'} use`;

  return (
    <Surface style={styles.card}>
      <ThemedText type="smallBold" themeColor="textSecondary" style={styles.label}>
        TASTE
      </ThemedText>

      <View style={styles.styleRow}>
        <View style={[styles.styleChip, { backgroundColor: theme.accentSoft }]}>
          <ThemedText type="smallBold" style={{ color: theme.accent }}>
            {style.label}
          </ThemedText>
        </View>
        <ThemedText type="small" themeColor="textSecondary" style={{ flex: 1 }}>
          {style.blurb}
        </ThemedText>
      </View>

      <View style={styles.factsRow}>
        {meanScore !== null && (
          <Fact value={meanScore.toFixed(1)} label="avg score" theme={theme} />
        )}
        {topDecade && <Fact value={topDecade} label="favorite era" theme={theme} />}
        {topArtists[0] && (
          <Fact value={`×${topArtists[0].count}`} label={topArtists[0].name} theme={theme} />
        )}
      </View>

      {topArtists.length > 0 && (
        <View style={styles.artistWrap}>
          <ThemedText type="small" themeColor="textSecondary">
            {who} on repeat
          </ThemedText>
          <View style={styles.chips}>
            {topArtists.map((a) => (
              <View
                key={a.name}
                style={[styles.artistChip, { backgroundColor: theme.backgroundSelected }]}>
                <ThemedText type="small">{a.name}</ThemedText>
              </View>
            ))}
          </View>
        </View>
      )}
    </Surface>
  );
}

function Fact({
  value,
  label,
  theme,
}: {
  value: string;
  label: string;
  theme: ReturnType<typeof useTheme>;
}) {
  return (
    <View style={styles.fact}>
      <ThemedText type="smallBold" style={{ fontSize: 18, color: theme.accent }} numberOfLines={1}>
        {value}
      </ThemedText>
      <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
        {label}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { gap: Spacing.three },
  label: {},
  styleRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  styleChip: { borderRadius: 999, paddingHorizontal: Spacing.three, paddingVertical: Spacing.one },
  factsRow: { flexDirection: 'row', gap: Spacing.two },
  fact: { flex: 1, gap: 2 },
  artistWrap: { gap: Spacing.two },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  artistChip: { borderRadius: 999, paddingHorizontal: Spacing.three, paddingVertical: Spacing.one },
});
