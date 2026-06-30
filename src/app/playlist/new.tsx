import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { TextField } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useHaptics } from '@/hooks/use-haptics';
import { useTheme } from '@/hooks/use-theme';
import { usePlaylists } from '@/playlists/store';

export default function NewPlaylistModal() {
  const theme = useTheme();
  const router = useRouter();
  const haptics = useHaptics();
  const { createPlaylist } = usePlaylists();
  const [name, setName] = useState('');

  function create() {
    if (!name.trim()) return;
    haptics.success();
    const playlist = createPlaylist(name);
    // replace so closing the new playlist returns to Profile, not this form.
    router.replace({ pathname: '/playlist/[id]', params: { id: playlist.id } });
  }

  return (
    <ThemedView style={styles.screen}>
      <View style={styles.topBar}>
        <Pressable onPress={() => router.back()} accessibilityLabel="Close" hitSlop={8}>
          <Ionicons name="close" size={26} color={theme.text} />
        </Pressable>
        <ThemedText type="smallBold">New playlist</ThemedText>
        <View style={{ width: 26 }} />
      </View>

      <View style={styles.body}>
        <TextField
          label="Playlist name"
          value={name}
          onChangeText={setName}
          placeholder="e.g. Late night"
          autoFocus
          maxLength={60}
          returnKeyType="done"
          onSubmitEditing={create}
        />
        <Pressable
          testID="create-playlist"
          onPress={create}
          disabled={!name.trim()}
          style={({ pressed }) => [styles.primary, { opacity: pressed || !name.trim() ? 0.6 : 1 }]}>
          <ThemedText type="smallBold" style={{ color: '#fff' }}>
            Create
          </ThemedText>
        </Pressable>
      </View>
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
  body: { padding: Spacing.four, gap: Spacing.three },
  primary: {
    backgroundColor: '#1D9E75',
    paddingVertical: Spacing.three,
    borderRadius: 12,
    alignItems: 'center',
  },
});
