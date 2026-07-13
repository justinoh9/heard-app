/**
 * The active recommendations backend. Supabase when configured, the on-device
 * AsyncStorage reader otherwise. Mirrors the other seams' provider modules.
 */

import { isSupabaseConfigured } from '@/lib/supabase';

import { LocalRecommendationsBackend } from './local-backend';
import { SupabaseRecommendationsBackend } from './supabase-backend';
import type { RecommendationsBackend } from './types';

export const recommendationsBackend: RecommendationsBackend = isSupabaseConfigured()
  ? new SupabaseRecommendationsBackend()
  : new LocalRecommendationsBackend();
