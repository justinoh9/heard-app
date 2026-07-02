/**
 * The active social backend. Mirrors src/data's choice: Supabase when the env
 * vars are set, the on-device AsyncStorage world otherwise. In its own module
 * (not store.tsx) so the choice is swappable and store stays about React state.
 */

import { isSupabaseConfigured } from '@/lib/supabase';

import { LocalSocialBackend } from './local-backend';
import { SupabaseSocialBackend } from './supabase-backend';
import type { SocialBackend } from './types';

export const socialBackend: SocialBackend = isSupabaseConfigured()
  ? new SupabaseSocialBackend()
  : new LocalSocialBackend();
