/**
 * The active notifications backend — Supabase when configured, empty on-device
 * world otherwise. Same one-line swap as the other seams.
 */

import { isSupabaseConfigured } from '@/lib/supabase';

import { LocalNotificationsBackend } from './local-backend';
import { SupabaseNotificationsBackend } from './supabase-backend';
import type { NotificationsBackend } from './types';

export const notificationsBackend: NotificationsBackend = isSupabaseConfigured()
  ? new SupabaseNotificationsBackend()
  : new LocalNotificationsBackend();
