/**
 * The active analytics backend — Supabase when configured, a no-op otherwise.
 * Same one-line swap as the other seams.
 */

import { isSupabaseConfigured } from '@/lib/supabase';

import { LocalAnalyticsBackend } from './local-backend';
import { SupabaseAnalyticsBackend } from './supabase-backend';
import type { AnalyticsBackend } from './types';

export const analyticsBackend: AnalyticsBackend = isSupabaseConfigured()
  ? new SupabaseAnalyticsBackend()
  : new LocalAnalyticsBackend();
