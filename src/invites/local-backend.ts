/**
 * On-device invites. Local mode is a single-device demo with no second account
 * to invite, so `mine` returns codes that look real (the screen renders honestly)
 * and `redeem` always declines — there is no inviter for it to connect you to.
 *
 * The codes are generated with the same alphabet as the database's, because the
 * point of local mode is that the UI behaves identically. Nothing reads them.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

import type { Invite, InvitesBackend } from './types';

const KEY = 'heard.invites';
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function makeCode(): string {
  let out = '';
  for (let i = 0; i < 6; i += 1) {
    out += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  }
  return out;
}

export class LocalInvitesBackend implements InvitesBackend {
  async mine(target = 5): Promise<Invite[]> {
    const raw = await AsyncStorage.getItem(KEY);
    let codes: string[] = [];
    try {
      const parsed = raw ? JSON.parse(raw) : [];
      if (Array.isArray(parsed)) codes = parsed as string[];
    } catch {
      codes = [];
    }
    // Top up, matching my_invites()'s idempotence.
    while (codes.length < target) codes.push(makeCode());
    await AsyncStorage.setItem(KEY, JSON.stringify(codes));
    return codes.map((code) => ({ code }));
  }

  async redeem(): Promise<string | null> {
    return null;
  }
}
