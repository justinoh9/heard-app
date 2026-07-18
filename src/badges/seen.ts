/**
 * Device-local store of badge ids already announced (or baselined) for a user.
 * Key ends with the user id so the local account-deletion sweep
 * (`heard.*.<userId>`) takes it too.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

const key = (userId: string) => `heard.badges.seen.${userId}`;

/** Null means "never observed on this device" — the baseline case. */
export async function getSeenBadges(userId: string): Promise<string[] | null> {
  try {
    const raw = await AsyncStorage.getItem(key(userId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string') : null;
  } catch {
    return null;
  }
}

export async function setSeenBadges(userId: string, ids: string[]): Promise<void> {
  try {
    await AsyncStorage.setItem(key(userId), JSON.stringify(ids));
  } catch {
    // Best-effort: a failed write means a possible re-announce later, which
    // the feed can survive; throwing here would take the announcer down.
  }
}
