/**
 * Privacy policy — a hard requirement for ad networks (AdSense), the Spotify
 * integration, and app-store listings later. Plain static content like
 * about.tsx: crawlable, no auth, linked from Settings and the sitemap.
 * Keep the "Advertising" section in sync with the AdSlot/AdSense wiring.
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
const EFFECTIVE_DATE = 'July 12, 2026';

export default function PrivacyScreen() {
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
        <ThemedText type="smallBold">Privacy policy</ThemedText>
        <View style={{ width: 26 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <PageContainer style={styles.inner}>
          <ThemedText type="subtitle">Privacy policy</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            Effective {EFFECTIVE_DATE}
          </ThemedText>
          <Paragraph>
            Jelli (“we”, “us”) is a social music-rating app available at myjelli.site. This policy
            explains what information Jelli collects, how it is used, and the choices you have.
          </Paragraph>

          <Section title="Information we collect">
            <Paragraph>
              Account information. When you create an account we collect your email address and a
              display name. Passwords are handled by our authentication provider (Supabase) and are
              never visible to us in plain text.
            </Paragraph>
            <Paragraph>
              Content you create. Ratings, rankings, reviews, comments, likes, follows, daily
              drops, concert logs, and favorite picks are stored with your account. Jelli is a
              social app: this content is public by design and visible to other users and to
              signed-out visitors.
            </Paragraph>
            <Paragraph>
              Venue locations. When you log a concert you can pick a venue from a search box. If you
              do, we store that venue’s published coordinates so the show can appear on your map.
              These are the venue’s coordinates, not yours — Jelli never requests or records your
              device’s location.
            </Paragraph>
            <Paragraph>
              Safety data. If you block someone or report content, we store that too. Unlike the
              rest of your activity, this is private: your block list is visible only to you, and a
              report is visible only to you and to whoever reviews it. We never tell someone that
              they have been blocked or reported, or by whom.
            </Paragraph>
            <Paragraph>
              On-device data. Some data never leaves your device: your listening streak, theme
              preference, and — if you connect Spotify — the tokens used to read your recently
              played tracks are stored in local storage on your device only.
            </Paragraph>
          </Section>

          <Section title="Third-party services">
            <Paragraph>
              Jelli is hosted on Vercel (web) and Supabase (database and authentication). Music
              search sends your search terms to Apple’s iTunes Search API, and metadata is enriched
              via Last.fm and Deezer; these requests include your search text but not your account
              identity. Venue search sends what you type to Photon, an OpenStreetMap geocoding
              service, on the same basis. If you choose to connect Spotify, Jelli reads your
              recently played tracks with your permission — you can disconnect at any time in
              Settings, and imported plays are never logged without your explicit action.
            </Paragraph>
          </Section>

          <Section title="Advertising and cookies">
            <Paragraph>
              Jelli may show ads served by Google AdSense on the web. Third-party vendors,
              including Google, use cookies to serve ads based on your prior visits to this and
              other websites. Google’s use of advertising cookies enables it and its partners to
              serve ads based on your visits to this site and other sites on the internet.
            </Paragraph>
            <Paragraph>
              You can opt out of personalized advertising by visiting Google Ads Settings
              (adssettings.google.com) or aboutads.info. Where required, we will ask for your
              consent before advertising cookies are used.
            </Paragraph>
          </Section>

          <Section title="How we use information">
            <Paragraph>
              We use your information to run Jelli: showing your rankings and activity to you and
              other users, computing taste-match scores, and keeping your account secure. We do not
              sell your personal information.
            </Paragraph>
          </Section>

          <Section title="Data retention and deletion">
            <Paragraph>
              You can delete your own comments in the app. To delete your account and its data,
              email us at {CONTACT_EMAIL} and we will remove it.
            </Paragraph>
          </Section>

          <Section title="Children">
            <Paragraph>
              Jelli is not directed to children under 13, and we do not knowingly collect personal
              information from them.
            </Paragraph>
          </Section>

          <Section title="Changes and contact">
            <Paragraph>
              We may update this policy as Jelli evolves; material changes will be reflected on
              this page with a new effective date. Questions? Email {CONTACT_EMAIL}.
            </Paragraph>
          </Section>

          <Pressable
            onPress={() => Linking.openURL(`mailto:${CONTACT_EMAIL}`)}
            hitSlop={4}
            style={styles.contact}>
            <ThemedText type="linkPrimary">Contact: {CONTACT_EMAIL}</ThemedText>
          </Pressable>
        </PageContainer>
      </ScrollView>
    </ThemedView>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <ThemedText type="smallBold" style={styles.sectionTitle}>
        {title}
      </ThemedText>
      {children}
    </View>
  );
}

function Paragraph({ children }: { children: React.ReactNode }) {
  return (
    <ThemedText type="small" themeColor="textSecondary" style={styles.paragraph}>
      {children}
    </ThemedText>
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
  section: { gap: Spacing.two, marginTop: Spacing.two },
  sectionTitle: { fontSize: 16 },
  paragraph: {},
  contact: { marginTop: Spacing.three },
});
