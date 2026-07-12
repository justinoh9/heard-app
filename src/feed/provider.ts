/**
 * The active daily-drop backend — Supabase when configured, on-device world
 * otherwise. Same one-line swap as the ratings/social/concerts providers.
 */

import { isSupabaseConfigured } from '@/lib/supabase';

import { LocalDropsBackend } from './local-backend';
import { SupabaseDropsBackend } from './supabase-backend';
import type { DropsBackend } from './types';

export const dropsBackend: DropsBackend = isSupabaseConfigured()
  ? new SupabaseDropsBackend()
  : new LocalDropsBackend();
