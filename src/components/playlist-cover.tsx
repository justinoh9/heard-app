import { StyleSheet, View } from 'react-native';

import { AlbumCover } from '@/components/album-cover';

/**
 * Playlist thumbnail: a single cover, or a 2x2 collage of the first four when a
 * playlist spans multiple albums. Empty playlists fall back to a placeholder.
 */
export function PlaylistCover({
  urls,
  size,
  radius = 10,
}: {
  urls: string[];
  size: number;
  radius?: number;
}) {
  if (urls.length <= 1) {
    return <AlbumCover uri={urls[0]} size={size} radius={radius} />;
  }
  const cell = Math.floor(size / 2);
  const cells = [urls[0], urls[1], urls[2], urls[3]];
  return (
    <View style={[styles.grid, { width: cell * 2, height: cell * 2, borderRadius: radius }]}>
      {cells.map((u, i) => (
        <AlbumCover key={i} uri={u} size={cell} radius={0} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', overflow: 'hidden' },
});
