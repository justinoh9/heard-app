/**
 * On-device auth backend. Stores a mock "users table" and the active session
 * in AsyncStorage (which uses localStorage on web, so the browser demo works).
 * Passwords are salted + SHA-256 hashed via expo-crypto — never stored plain.
 *
 * This is a development seam, NOT production security: it's all client-side.
 * Real accounts come from `SupabaseAuthBackend` later (same interface).
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';

import { AuthError, type AuthBackend, type Session, type SignUpInput, type User } from './types';

interface StoredUser extends User {
  salt: string;
  passwordHash: string;
}

const USERS_KEY = 'heard.users';
const SESSION_KEY = 'heard.session';

async function hash(password: string, salt: string): Promise<string> {
  return Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, `${salt}:${password}`);
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function publicUser(u: StoredUser): User {
  return { id: u.id, email: u.email, displayName: u.displayName, createdAt: u.createdAt };
}

export class LocalAuthBackend implements AuthBackend {
  private async readUsers(): Promise<StoredUser[]> {
    const raw = await AsyncStorage.getItem(USERS_KEY);
    return raw ? (JSON.parse(raw) as StoredUser[]) : [];
  }

  private async writeUsers(users: StoredUser[]): Promise<void> {
    await AsyncStorage.setItem(USERS_KEY, JSON.stringify(users));
  }

  async getSession(): Promise<Session | null> {
    const userId = await AsyncStorage.getItem(SESSION_KEY);
    if (!userId) return null;
    const users = await this.readUsers();
    const user = users.find((u) => u.id === userId);
    return user ? { user: publicUser(user) } : null;
  }

  async signUp(input: SignUpInput): Promise<Session> {
    const displayName = input.displayName.trim();
    const email = normalizeEmail(input.email);

    if (!displayName) throw new AuthError('Enter a display name.');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new AuthError('Enter a valid email.');
    if (input.password.length < 6) throw new AuthError('Password must be at least 6 characters.');

    const users = await this.readUsers();
    if (users.some((u) => u.email === email)) {
      throw new AuthError('That email is already registered. Try signing in.');
    }

    const salt = Crypto.randomUUID();
    const stored: StoredUser = {
      id: Crypto.randomUUID(),
      email,
      displayName,
      createdAt: new Date().toISOString(),
      salt,
      passwordHash: await hash(input.password, salt),
    };
    await this.writeUsers([...users, stored]);
    await AsyncStorage.setItem(SESSION_KEY, stored.id);
    return { user: publicUser(stored) };
  }

  async signIn(email: string, password: string): Promise<Session> {
    const normalized = normalizeEmail(email);
    const users = await this.readUsers();
    const user = users.find((u) => u.email === normalized);
    // Same message for unknown email vs wrong password (don't leak which).
    if (!user || (await hash(password, user.salt)) !== user.passwordHash) {
      throw new AuthError('Wrong email or password.');
    }
    await AsyncStorage.setItem(SESSION_KEY, user.id);
    return { user: publicUser(user) };
  }

  async signOut(): Promise<void> {
    await AsyncStorage.removeItem(SESSION_KEY);
  }
}
