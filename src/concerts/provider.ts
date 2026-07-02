/**
 * The active concerts backend — Supabase when configured, on-device world
 * otherwise. Same one-line swap as ratings/social providers.
 */

import { isSupabaseConfigured } from '@/lib/supabase';

import { LocalConcertsBackend } from './local-backend';
import { SupabaseConcertsBackend } from './supabase-backend';
import type { ConcertsBackend } from './types';

export const concertsBackend: ConcertsBackend = isSupabaseConfigured()
  ? new SupabaseConcertsBackend()
  : new LocalConcertsBackend();
