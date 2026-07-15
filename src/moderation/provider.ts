/**
 * The active moderation backend — Supabase when configured, on-device
 * otherwise. Same one-line swap as the ratings/social/concerts providers.
 */

import { isSupabaseConfigured } from '@/lib/supabase';

import { LocalModerationBackend } from './local-backend';
import { SupabaseModerationBackend } from './supabase-backend';
import type { ModerationBackend } from './types';

export const moderationBackend: ModerationBackend = isSupabaseConfigured()
  ? new SupabaseModerationBackend()
  : new LocalModerationBackend();
