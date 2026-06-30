import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

/** Thin wrapper over expo-haptics; no-ops on web where the native module is unsupported. */
export function useHaptics() {
  const supported = Platform.OS !== 'web';

  return {
    selection: () => {
      if (supported) Haptics.selectionAsync();
    },
    light: () => {
      if (supported) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    },
    success: () => {
      if (supported) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
  };
}
