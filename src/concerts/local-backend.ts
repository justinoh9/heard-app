/**
 * On-device concerts backend: one device-global AsyncStorage list (like the
 * local social feed), so tagged local accounts see shows on their own
 * profiles too.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';

import { concertsFor } from './rows';
import type { Concert, ConcertsBackend, NewConcert } from './types';

const CONCERTS_KEY = 'heard.concerts';
/** Bounded like the local feed — plenty for an on-device demo. */
const MAX_CONCERTS = 500;

async function readAll(): Promise<Concert[]> {
  const raw = await AsyncStorage.getItem(CONCERTS_KEY);
  return raw ? (JSON.parse(raw) as Concert[]) : [];
}

export class LocalConcertsBackend implements ConcertsBackend {
  async listFor(userId: string): Promise<Concert[]> {
    return concertsFor(userId, await readAll());
  }

  async add(concert: NewConcert): Promise<Concert> {
    const stored: Concert = {
      ...concert,
      id: Crypto.randomUUID(),
      createdAt: new Date().toISOString(),
    };
    const all = await readAll();
    all.push(stored);
    const capped = all.length > MAX_CONCERTS ? all.slice(all.length - MAX_CONCERTS) : all;
    await AsyncStorage.setItem(CONCERTS_KEY, JSON.stringify(capped));
    return stored;
  }
}
