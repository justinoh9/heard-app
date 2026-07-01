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

export default function SignInScreen() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

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

  return (
    <ThemedView style={styles.screen}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <PageContainer maxWidth={440} style={styles.inner}>
            <BrandHeader tagline="Welcome back" />

            <SpotifyButton onPress={() => setError('Spotify sign-in is coming soon.')} />
            <OrDivider />

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
              <ThemedText type="small" style={styles.error}>
                {error}
              </ThemedText>
            )}

            <Pressable
              testID="auth-submit"
              onPress={submit}
              style={({ pressed }) => [styles.primary, { opacity: pressed || busy ? 0.7 : 1 }]}>
              {busy ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <ThemedText type="smallBold" style={{ color: '#fff' }}>
                  Sign in
                </ThemedText>
              )}
            </Pressable>

            <ThemedText type="small" themeColor="textSecondary" style={styles.footer}>
              New here?{' '}
              <Link href="/(auth)/sign-up" replace style={styles.link}>
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
  error: { color: '#E24B4A' },
  primary: {
    backgroundColor: '#1D9E75',
    paddingVertical: Spacing.three,
    borderRadius: 12,
    alignItems: 'center',
    alignSelf: 'stretch',
  },
  footer: { textAlign: 'center', marginTop: Spacing.two },
  link: { color: '#1D9E75', fontWeight: '700' },
});
