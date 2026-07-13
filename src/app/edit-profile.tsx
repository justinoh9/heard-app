import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { useAuthGate } from '@/auth/use-require-auth';
import { Avatar } from '@/components/avatar';
import { ModalDialogFrame } from '@/components/modal-dialog-frame';
import { TextField } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { useToast } from '@/components/toast';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { isSupabaseConfigured } from '@/lib/supabase';
import { uploadAvatar } from '@/social/avatar';
import { useSocial } from '@/social/store';
import { HandleTakenError } from '@/social/types';

/** Only lowercase letters, digits, and underscores — a clean, URL-safe handle. */
function normalizeHandle(raw: string): string {
  return raw.toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 20);
}

/**
 * Edit the viewer's identity (ROADMAP G4): avatar, a unique @handle, and a
 * short bio. The avatar picker uploads to Supabase Storage (see avatar.ts) and
 * is shown only on the cloud backend. Reached from the Profile tab's "Edit
 * profile" action.
 */
export default function EditProfileModal() {
  const theme = useTheme();
  const router = useRouter();
  const toast = useToast();
  const user = useAuthGate();
  const { myProfile, updateProfile } = useSocial();

  const [handle, setHandle] = useState(myProfile?.handle ?? '');
  const [bio, setBio] = useState(myProfile?.bio ?? '');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(myProfile?.avatarUrl ?? null);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Avatars upload to Supabase Storage, so the picker only makes sense on the
  // cloud backend; local-mode accounts keep the initials fallback.
  const canUploadAvatar = isSupabaseConfigured();

  async function pickAvatar() {
    if (uploading || !user) return;
    setError(null);
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      setError('Allow photo access to set an avatar.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
      base64: true,
    });
    if (result.canceled) return;
    const asset = result.assets[0];
    if (!asset?.base64) return;
    setUploading(true);
    try {
      const url = await uploadAvatar(user.id, asset.base64, asset.mimeType);
      setAvatarUrl(url);
    } catch (e) {
      console.warn('[edit-profile] avatar upload failed:', e);
      setError('Could not upload that image. Try again.');
    } finally {
      setUploading(false);
    }
  }

  async function save() {
    if (busy || uploading) return;
    setError(null);
    // Handle is optional, but if given it must be at least 3 chars.
    if (handle && handle.length < 3) {
      setError('Handles need at least 3 characters.');
      return;
    }
    setBusy(true);
    try {
      await updateProfile({
        handle: handle || null,
        bio: bio.trim() || null,
        avatarUrl: avatarUrl || null,
      });
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
        {canUploadAvatar ? (
          <View style={styles.avatarRow}>
            <Pressable
              testID="edit-avatar"
              onPress={pickAvatar}
              accessibilityLabel="Change avatar"
              disabled={uploading}
              style={({ pressed }) => [styles.avatarWrap, { opacity: pressed ? 0.8 : 1 }]}>
              <Avatar name={user.displayName} uri={avatarUrl} size={84} />
              <View style={[styles.avatarBadge, { backgroundColor: theme.accent }]}>
                {uploading ? (
                  <ActivityIndicator size="small" color={theme.onAccent} />
                ) : (
                  <Ionicons name="camera" size={16} color={theme.onAccent} />
                )}
              </View>
            </Pressable>
            <ThemedText type="small" themeColor="textSecondary">
              {uploading ? 'Uploading…' : 'Tap to change your photo'}
            </ThemedText>
          </View>
        ) : null}

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
  avatarRow: { alignItems: 'center', gap: Spacing.two },
  avatarWrap: { position: 'relative' },
  avatarBadge: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bioInput: { minHeight: 70, textAlignVertical: 'top' },
  primary: {
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.five,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: Spacing.two,
  },
});
