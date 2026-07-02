/**
 * Supabase client, used by the comments (src/comments/), likes (src/likes/),
 * and ratings (src/data/supabase-ratings-backend.ts) seams. Auth stays on
 * LocalAuthBackend — a Supabase Auth migration is planned (blueprint §3.4).
 *
 * No Supabase Auth session exists here (LocalAuthBackend stays authoritative
 * for identity), so session persistence is explicitly disabled below.
 *
 * Lazily initialized: this module is reachable from the root layout's import
 * graph (log.tsx is in the same web bundle as everything else), so throwing
 * at module load would crash the entire app — not just comments — for anyone
 * without a Supabase project configured yet. The throw is deferred to first
 * actual use (i.e. when a screen tries to load/post comments).
 */

import 'react-native-url-polyfill/auto';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let client: SupabaseClient | null = null;

/**
 * Whether Supabase env vars are present — for seams that can degrade to a
 * local backend instead of throwing (ratings). Comments/likes have no local
 * fallback, so they call getSupabase() directly and surface its error.
 */
export function isSupabaseConfigured(): boolean {
  return !!process.env.EXPO_PUBLIC_SUPABASE_URL && !!process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
}

export function getSupabase(): SupabaseClient {
  if (client) return client;

  const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error(
      'Missing EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY. Copy .env.example to .env and fill in your Supabase project values.',
    );
  }

  client = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  return client;
}
