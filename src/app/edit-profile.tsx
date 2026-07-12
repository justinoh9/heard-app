import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { useAuthGate } from '@/auth/use-require-auth';
import { ModalDialogFrame } from '@/components/modal-dialog-frame';
import { TextField } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { useToast } from '@/components/toast';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useSocial } from '@/social/store';
import { HandleTakenError } from '@/social/types';

/** Only lowercase letters, digits, and underscores — a clean, URL-safe handle. */
function normalizeHandle(raw: string): string {
  return raw.toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 20);
}

/**
 * Edit the viewer's identity (ROADMAP G4): a unique @handle and a short bio.
 * Avatar upload is a follow-up (needs Supabase Storage), so the field isn't
 * here yet. Reached from the Profile tab's "Edit profile" action.
 */
export default function EditProfileModal() {
  const theme = useTheme();
  const router = useRouter();
  const toast = useToast();
  const user = useAuthGate();
  const { myProfile, updateProfile } = useSocial();

  const [handle, setHandle] = useState(myProfile?.handle ?? '');
  const [bio, setBio] = useState(myProfile?.bio ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    if (busy) return;
    setError(null);
    // Handle is optional, but if given it must be at least 3 chars.
    if (handle && handle.length < 3) {
      setError('Handles need at least 3 characters.');
      return;
    }
    setBusy(true);
    try {
      await updateProfile({ handle: handle || null, bio: bio.trim() || null });
      router.back();
      toast('Profile updated', '✨');
    } catch (e) {
      setError(e instanceof HandleTakenError ? e.message : 'Could not save. Try again.');
      setBusy(false);
    }
  }

  if (!user) return null;

  return (
    <ModalDialogFrame>
      <View style={styles.topBar}>
        <Pressable onPress={() => router.back()} accessibilityLabel="Close" hitSlop={8}>
          <Ionicons name="close" size={26} color={theme.text} />
        </Pressable>
        <ThemedText type="smallBold">Edit profile</ThemedText>
        <View style={{ width: 26 }} />
      </View>

      <View style={styles.body}>
        <TextField
          testID="edit-handle"
          label="Handle"
          value={handle}
          onChangeText={(t) => setHandle(normalizeHandle(t))}
          placeholder="yourname"
          autoCapitalize="none"
          autoCorrect={false}
        />
        <ThemedText type="small" themeColor="textSecondary">
          {handle ? `Your handle: @${handle}` : 'Lowercase letters, numbers, and underscores — your unique @name.'}
        </ThemedText>

        <TextField
          testID="edit-bio"
          label="Bio"
          value={bio}
          onChangeText={setBio}
          placeholder="A line about your taste"
          multiline
          maxLength={160}
          style={styles.bioInput}
        />

        {error && (
          <ThemedText type="small" style={{ color: theme.danger }}>
            {error}
          </ThemedText>
        )}

        <Pressable
          testID="edit-profile-save"
          onPress={save}
          style={({ pressed }) => [
            styles.primary,
            { backgroundColor: theme.accent, opacity: pressed || busy ? 0.7 : 1 },
          ]}>
          {busy ? (
            <ActivityIndicator color={theme.onAccent} />
          ) : (
            <ThemedText type="smallBold" style={{ color: theme.onAccent }}>
              Save
            </ThemedText>
          )}
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
  bioInput: { minHeight: 70, textAlignVertical: 'top' },
  primary: {
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.five,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: Spacing.two,
  },
});
