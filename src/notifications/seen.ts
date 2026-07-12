/**
 * Device-local "last opened notifications" timestamp, per user (AsyncStorage,
 * like streaks / onboarding). Drives the unread badge — deliberately not in
 * Supabase, since read-state is a per-device concern.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

const keyFor = (userId: string) => `heard.notifs.seen.${userId}`;

export async function getLastSeen(userId: string): Promise<string | null> {
  return AsyncStorage.getItem(keyFor(userId));
}

/** Stamp "seen now" (ISO). Called when the notifications screen opens. */
export async function markSeen(userId: string, nowIso: string): Promise<void> {
  await AsyncStorage.setItem(keyFor(userId), nowIso);
}
