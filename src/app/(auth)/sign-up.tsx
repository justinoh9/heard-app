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

export default function SignUpScreen() {
  const { signUp } = useAuth();
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (busy) return;
    setError(null);
    setBusy(true);
    try {
      await signUp({ displayName, email, password });
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
            <BrandHeader tagline="Rate music. Build your taste." />

            <SpotifyButton onPress={() => setError('Spotify sign-up is coming soon.')} />
            <OrDivider />

            <TextField
              label="Display name"
              value={displayName}
              onChangeText={setDisplayName}
              placeholder="What friends will see"
              autoCapitalize="words"
              autoComplete="name"
            />
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
              placeholder="At least 6 characters"
              secureTextEntry
              autoComplete="new-password"
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
                  Create account
                </ThemedText>
              )}
            </Pressable>

            <ThemedText type="small" themeColor="textSecondary" style={styles.footer}>
              Already have an account?{' '}
              <Link href="/(auth)/sign-in" replace style={styles.link}>
                Sign in
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
