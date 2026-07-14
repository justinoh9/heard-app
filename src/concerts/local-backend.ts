/**
 * On-device concerts backend: one device-global AsyncStorage list (like the
 * local social feed), so tagged local accounts see shows on their own
 * profiles too. Mirrors the Supabase backend's v2 shape (status + tag
 * confirm state).
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
  if (!raw) return [];
  const parsed = JSON.parse(raw) as Concert[];
  // Tolerate rows written by the pre-v2 shape (taggedUserIds / no status).
  return parsed.map((c) => ({
    ...c,
    status: c.status ?? 'attended',
    tags:
      c.tags ??
      ((c as unknown as { taggedUserIds?: string[] }).taggedUserIds ?? []).map((userId) => ({
        userId,
        status: 'confirmed' as const,
      })),
  }));
}

async function writeAll(all: Concert[]): Promise<void> {
  const capped = all.length > MAX_CONCERTS ? all.slice(all.length - MAX_CONCERTS) : all;
  await AsyncStorage.setItem(CONCERTS_KEY, JSON.stringify(capped));
}

export class LocalConcertsBackend implements ConcertsBackend {
  async listFor(userId: string): Promise<Concert[]> {
    return concertsFor(userId, await readAll());
  }

  async add(concert: NewConcert): Promise<Concert> {
    const stored: Concert = {
      id: Crypto.randomUUID(),
      userId: concert.userId,
      artistName: concert.artistName,
      artistId: concert.artistId,
      venue: concert.venue,
      city: concert.city,
      showDate: concert.showDate,
      score: concert.score,
      notes: concert.notes,
      status: concert.status,
      tags: concert.taggedUserIds.map((userId) => ({ userId, status: 'pending' as const })),
      createdAt: new Date().toISOString(),
    };
    const all = await readAll();
    all.push(stored);
    await writeAll(all);
    return stored;
  }

  async markAttended(concertId: string): Promise<void> {
    const all = await readAll();
    await writeAll(all.map((c) => (c.id === concertId ? { ...c, status: 'attended' } : c)));
  }

  async remove(concertId: string): Promise<void> {
    const all = await readAll();
    await writeAll(all.filter((c) => c.id !== concertId));
  }

  async confirmTag(concertId: string, userId: string): Promise<void> {
    const all = await readAll();
    await writeAll(
      all.map((c) =>
        c.id === concertId
          ? { ...c, tags: c.tags.map((t) => (t.userId === userId ? { ...t, status: 'confirmed' } : t)) }
          : c,
      ),
    );
  }

  async declineTag(concertId: string, userId: string): Promise<void> {
    const all = await readAll();
    await writeAll(
      all.map((c) =>
        c.id === concertId ? { ...c, tags: c.tags.filter((t) => t.userId !== userId) } : c,
      ),
    );
  }
}
