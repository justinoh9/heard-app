/**
 * The active want-to-listen backend — Supabase when configured, on-device
 * otherwise. Same one-line swap as the other seams.
 */

import { isSupabaseConfigured } from '@/lib/supabase';

import { LocalQueueBackend } from './local-backend';
import { SupabaseQueueBackend } from './supabase-backend';
import type { QueueBackend } from './types';

export const queueBackend: QueueBackend = isSupabaseConfigured()
  ? new SupabaseQueueBackend()
  : new LocalQueueBackend();
