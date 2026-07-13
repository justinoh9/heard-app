/**
 * The active browse backend. Supabase when configured (community-wide
 * discovery), the on-device AsyncStorage fold otherwise. Mirrors the other
 * seams' provider modules.
 */

import { isSupabaseConfigured } from '@/lib/supabase';

import { LocalBrowseBackend } from './local-backend';
import { SupabaseBrowseBackend } from './supabase-backend';
import type { BrowseBackend } from './types';

export const browseBackend: BrowseBackend = isSupabaseConfigured()
  ? new SupabaseBrowseBackend()
  : new LocalBrowseBackend();
