import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useState } from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';

import { Skeleton } from '@/components/skeleton';
import { useTheme } from '@/hooks/use-theme';

type Props = {
  uri?: string;
  /** Fixed square size in px. Ignored when `fill` is set. */
  size?: number;
  /** Fill the parent width as a square (for cards/modals). */
  fill?: boolean;
  radius?: number;
  /** Icon shown when there's no artwork. Defaults to a disc; use 'person' for artists. */
  fallbackIcon?: React.ComponentProps<typeof Ionicons>['name'];
  style?: ViewStyle;
};

/** Album/artist artwork with an icon fallback for missing/broken images. */
export function AlbumCover({
  uri,
  size = 56,
  fill = false,
  radius = 8,
  fallbackIcon = 'disc-outline',
  style,
}: Props) {
  const theme = useTheme();
  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const showImage = !!uri && !failed;

  const box: ViewStyle = fill
    ? { width: '100%', aspectRatio: 1 }
    : { width: size, height: size };

  return (
    <View
      style={[
        box,
        {
          borderRadius: radius,
          overflow: 'hidden',
          backgroundColor: theme.backgroundSelected,
          alignItems: 'center',
          justifyContent: 'center',
        },
        style,
      ]}>
      {showImage ? (
        <>
          <Image
            source={{ uri }}
            style={{ width: '100%', height: '100%' }}
            contentFit="cover"
            transition={150}
            onLoad={() => setLoaded(true)}
            onError={() => setFailed(true)}
          />
          {!loaded && <Skeleton style={StyleSheet.absoluteFill} radius={0} />}
        </>
      ) : (
        <Ionicons name={fallbackIcon} size={fill ? 48 : size * 0.42} color={theme.textSecondary} />
      )}
    </View>
  );
}
