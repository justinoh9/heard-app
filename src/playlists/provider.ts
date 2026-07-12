/**
 * The active lists backend — Supabase when configured, on-device world
 * otherwise. Same one-line swap as the ratings/social/concerts/drops providers.
 */

import { isSupabaseConfigured } from '@/lib/supabase';

import { LocalListsBackend } from './local-backend';
import { SupabaseListsBackend } from './supabase-backend';
import type { ListsBackend } from './types';

export const listsBackend: ListsBackend = isSupabaseConfigured()
  ? new SupabaseListsBackend()
  : new LocalListsBackend();
