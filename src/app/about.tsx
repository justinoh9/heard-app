/**
 * Public marketing page — real, crawlable copy about what Jelli is. Exists
 * for search engines and ad-network reviewers (AdSense rejects sites that
 * look like an empty app shell), and as the destination for ad/social links.
 * Statically rendered to about.html by the web export; linked from Settings
 * and listed in public/sitemap.xml. No auth, no data loads — plain content.
 */
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Linking, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { PageContainer } from '@/components/page-container';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

const CONTACT_EMAIL = 'ohjustin1009@gmail.com';

const PILLARS: { icon: keyof typeof Ionicons.glyphMap; title: string; body: string }[] = [
  {
    icon: 'trophy-outline',
    title: 'Rank, don’t just rate',
    body: 'Stars are vague. Jelli asks the question you can actually answer — “which of these two do you like more?” — and head-to-head matchups build your definitive, ordered list of songs and albums.',
  },
  {
    icon: 'people-outline',
    title: 'Match tastes with friends',
    body: 'Follow friends to fill your feed with what they’re rating and listening to. Every profile shows a taste-match percentage and the favorites you share, so the “what should I listen to?” conversation starts itself.',
  },
  {
    icon: 'mic-outline',
    title: 'Log the live stuff',
    body: 'Concerts count too. Log shows with the venue, the date, and the friends you went with — they’ll see it on their profile, and your map of live music grows with every gig.',
  },
  {
    icon: 'sparkles-outline',
    title: 'Your Wrapped, always on',
    body: 'Why wait for December? Jelli keeps a running recap of your listening year — score histograms, top artists, decades, and the venue you can’t stay away from.',
  },
];

export default function AboutScreen() {
  const theme = useTheme();
  const router = useRouter();

  return (
    <ThemedView style={styles.screen}>
      <View style={styles.topBar}>
        <Pressable
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
          accessibilityLabel="Back"
          hitSlop={8}>
          <Ionicons name="chevron-back" size={26} color={theme.text} />
        </Pressable>
        <ThemedText type="smallBold">About</ThemedText>
        <View style={{ width: 26 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <PageContainer style={styles.inner}>
          <View style={styles.hero}>
            <ThemedText type="title">Jelli</ThemedText>
            <ThemedText type="subtitle" style={styles.tagline}>
              Rank the music you love.
            </ThemedText>
            <ThemedText themeColor="textSecondary" style={styles.lede}>
              Jelli is a social music app for people with opinions. Rate what you hear, settle it
              with head-to-head matchups, follow your friends, and find out — with a number — how
              much your tastes actually overlap.
            </ThemedText>
          </View>

          <View style={styles.ctaRow}>
            <Pressable
              testID="about-open-app"
              onPress={() => router.replace('/')}
              style={({ pressed }) => [
                styles.cta,
                { backgroundColor: theme.accent, opacity: pressed ? 0.8 : 1 },
              ]}>
              <ThemedText type="smallBold" style={{ color: theme.onAccent }}>
                Open Jelli
              </ThemedText>
            </Pressable>
            <Pressable
              testID="about-sign-up"
              onPress={() => router.push('/(auth)/sign-up')}
              style={({ pressed }) => [
                styles.cta,
                { backgroundColor: theme.backgroundElement, opacity: pressed ? 0.8 : 1 },
              ]}>
              <ThemedText type="smallBold">Create a free account</ThemedText>
            </Pressable>
          </View>

          {PILLARS.map((pillar) => (
            <View
              key={pillar.title}
              style={[styles.pillar, { backgroundColor: theme.backgroundElement }]}>
              <View style={[styles.pillarIcon, { backgroundColor: theme.accentSoft }]}>
                <Ionicons name={pillar.icon} size={22} color={theme.accent} />
              </View>
              <View style={{ flex: 1, gap: Spacing.one }}>
                <ThemedText type="smallBold" style={styles.pillarTitle}>
                  {pillar.title}
                </ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  {pillar.body}
                </ThemedText>
              </View>
            </View>
          ))}

          <View style={styles.section}>
            <ThemedText type="smallBold" themeColor="textSecondary" style={styles.sectionLabel}>
              HOW IT WORKS
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              Search any song or album, give it a score, and Jelli lines it up against things
              you’ve already rated until it lands exactly where it belongs in your list. Post a
              daily drop of what you’re listening to right now, keep a streak going, and browse
              anyone’s rankings — no account needed to look around. Jelli runs in your browser
              today, with mobile apps on the way.
            </ThemedText>
          </View>

          <View style={styles.footer}>
            <Pressable onPress={() => router.push('/privacy')} hitSlop={4}>
              <ThemedText type="linkPrimary">Privacy policy</ThemedText>
            </Pressable>
            <Pressable onPress={() => Linking.openURL(`mailto:${CONTACT_EMAIL}`)} hitSlop={4}>
              <ThemedText type="linkPrimary">Contact: {CONTACT_EMAIL}</ThemedText>
            </Pressable>
            <ThemedText type="small" themeColor="textSecondary">
              © 2026 Jelli · myjelli.site
            </ThemedText>
          </View>
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
  hero: { gap: Spacing.two, marginTop: Spacing.three },
  tagline: { fontSize: 24, lineHeight: 32 },
  lede: { marginTop: Spacing.one },
  ctaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two, marginBottom: Spacing.two },
  cta: {
    borderRadius: 999,
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.two + 2,
  },
  pillar: { flexDirection: 'row', gap: Spacing.three, borderRadius: 12, padding: Spacing.three },
  pillarIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pillarTitle: { fontSize: 16 },
  section: { gap: Spacing.two, marginTop: Spacing.two },
  sectionLabel: {},
  footer: { gap: Spacing.one, marginTop: Spacing.four, alignItems: 'flex-start' },
});
