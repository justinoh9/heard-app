/**
 * The active auth backend — Supabase Auth when env is configured, the on-device
 * LocalAuthBackend otherwise. Same one-line swap as the ratings/social/concerts
 * providers, so `store.tsx` stays about React state, not backend selection.
 */

import { isSupabaseConfigured } from '@/lib/supabase';

import { LocalAuthBackend } from './local-backend';
import { SupabaseAuthBackend } from './supabase-backend';
import type { AuthBackend } from './types';

export const authBackend: AuthBackend = isSupabaseConfigured()
  ? new SupabaseAuthBackend()
  : new LocalAuthBackend();
