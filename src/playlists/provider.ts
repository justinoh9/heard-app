/**
 * The active lists backend — Supabase when configured, on-device otherwise.
 * Same one-line swap as ratings/social/concerts providers.
 */

import { isSupabaseConfigured } from '@/lib/supabase';

import { LocalPlaylistsBackend } from './local-backend';
import { SupabasePlaylistsBackend } from './supabase-backend';
import type { PlaylistsBackend } from './types';

export const playlistsBackend: PlaylistsBackend = isSupabaseConfigured()
  ? new SupabasePlaylistsBackend()
  : new LocalPlaylistsBackend();
