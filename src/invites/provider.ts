/**
 * The active invites backend — Supabase when configured, on-device otherwise.
 * Same one-line swap as the other seams.
 */

import { isSupabaseConfigured } from '@/lib/supabase';

import { LocalInvitesBackend } from './local-backend';
import { SupabaseInvitesBackend } from './supabase-backend';
import type { InvitesBackend } from './types';

export const invitesBackend: InvitesBackend = isSupabaseConfigured()
  ? new SupabaseInvitesBackend()
  : new LocalInvitesBackend();
