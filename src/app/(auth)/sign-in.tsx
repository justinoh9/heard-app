import { Link } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
} from 'react-native';

import { PageContainer } from '@/components/page-container';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { TextField } from '@/components/text-field';
import { Spacing } from '@/constants/theme';
import { useAuth } from '@/auth/store';
import { BrandHeader, OrDivider, SpotifyButton } from '@/auth/ui';
import { AuthError } from '@/auth/types';
import { friendlyMessage, takePendingOAuthError } from '@/auth/oauth-error';
import { useTheme } from '@/hooks/use-theme';

export default function SignInScreen() {
  const theme = useTheme();
  const { signIn, signInWithSpotify } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  // Surface an OAuth-redirect failure (e.g. Spotify login) stashed by the root
  // layout, so a bounced sign-in shows a reason instead of a silent Feed.
  const [error, setError] = useState<string | null>(() => {
    const oauth = takePendingOAuthError();
    return oauth ? friendlyMessage(oauth) : null;
  });
  const [busy, setBusy] = useState(false);
  const [spotifyBusy, setSpotifyBusy] = useState(false);

  async function submit() {
    if (busy) return;
    setError(null);
    setBusy(true);
    try {
      await signIn(email, password);
      // Redirect handled by the root navigator on status change.
    } catch (e) {
      setError(e instanceof AuthError ? e.message : 'Something went wrong. Try again.');
      setBusy(false);
    }
  }

  async function spotify() {
    if (!signInWithSpotify || spotifyBusy) return;
    setError(null);
    setSpotifyBusy(true);
    try {
      await signInWithSpotify();
      // On web the page redirects to Spotify; the session lands on return.
    } catch (e) {
      setError(e instanceof AuthError ? e.message : 'Spotify sign-in failed. Try again.');
      setSpotifyBusy(false);
    }
  }

  return (
    <ThemedView style={styles.screen}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <PageContainer maxWidth={440} style={styles.inner}>
            <BrandHeader tagline="Welcome back" />

            {signInWithSpotify && (
              <>
                <SpotifyButton onPress={spotify} busy={spotifyBusy} />
                <OrDivider />
              </>
            )}

            <TextField
              label="Email"
              value={email}
              onChangeText={setEmail}
              placeholder="name@email.com"
              autoCapitalize="none"
              keyboardType="email-address"
              autoComplete="email"
            />
            <TextField
              label="Password"
              value={password}
              onChangeText={setPassword}
              placeholder="Your password"
              secureTextEntry
              onSubmitEditing={submit}
            />

            {error && (
              <ThemedText type="small" style={{ color: theme.danger }}>
                {error}
              </ThemedText>
            )}

            <Pressable
              testID="auth-submit"
              onPress={submit}
              style={({ pressed }) => [
                styles.primary,
                { backgroundColor: theme.accent, opacity: pressed || busy ? 0.7 : 1 },
              ]}>
              {busy ? (
                <ActivityIndicator color={theme.onAccent} />
              ) : (
                <ThemedText type="smallBold" style={{ color: theme.onAccent }}>
                  Sign in
                </ThemedText>
              )}
            </Pressable>

            <ThemedText type="small" themeColor="textSecondary" style={styles.footer}>
              New here?{' '}
              <Link href="/(auth)/sign-up" replace style={[styles.link, { color: theme.accent }]}>
                Create an account
              </Link>
            </ThemedText>
          </PageContainer>
        </ScrollView>
      </KeyboardAvoidingView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  flex: { flex: 1 },
  content: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: Spacing.four,
  },
  inner: { gap: Spacing.three },
  primary: {
    paddingVertical: Spacing.three,
    borderRadius: 12,
    alignItems: 'center',
    alignSelf: 'stretch',
  },
  footer: { textAlign: 'center', marginTop: Spacing.two },
  link: { fontWeight: '700' },
});
