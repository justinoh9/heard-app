/**
 * The active ratings backend, shared by the viewer's own store (store.ts) and
 * read-only lookups of *other* users' lists (the compatibility banner on
 * /user/[id]). Stateless, so one instance serves both.
 */

import { isSupabaseConfigured } from '@/lib/supabase';

import { LocalRatingsBackend, type RatingsBackend } from './ratings-backend';
import { SupabaseRatingsBackend } from './supabase-ratings-backend';

export const ratingsBackend: RatingsBackend = isSupabaseConfigured()
  ? new SupabaseRatingsBackend()
  : new LocalRatingsBackend();
