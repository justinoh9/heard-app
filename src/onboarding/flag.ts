/**
 * Per-user "has finished onboarding" flag, stored on-device (AsyncStorage) like
 * streaks. Device-local on purpose: it only decides whether to *show* the
 * wizard, not any shared data — the ratings the wizard seeds persist to the
 * real backend, so a returning user on another device simply already has a
 * non-empty list and the gate skips onboarding anyway.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

const keyFor = (userId: string) => `heard.onboarded.${userId}`;

export async function hasOnboarded(userId: string): Promise<boolean> {
  return (await AsyncStorage.getItem(keyFor(userId))) === '1';
}

export async function markOnboarded(userId: string): Promise<void> {
  await AsyncStorage.setItem(keyFor(userId), '1');
}
