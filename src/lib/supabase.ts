/**
 * Supabase client, used by the auth (src/auth/supabase-backend.ts), comments
 * (src/comments/), likes (src/likes/), social (src/social/), concerts, and
 * ratings seams.
 *
 * Session persistence is ENABLED: when Supabase Auth is the active auth backend
 * (SupabaseAuthBackend), signing in stores a session in AsyncStorage (which is
 * localStorage on web), and every subsequent request carries the user's JWT —
 * so `auth.uid()` becomes available to RLS. When the LocalAuthBackend is active
 * instead (no env configured) there's simply no session and requests use the
 * anon key, so enabling persistence is harmless.
 *
 * Lazily initialized: this module is reachable from the root layout's import
 * graph, so throwing at module load would crash the entire app — not just one
 * feature — for anyone without a Supabase project configured yet. The throw is
 * deferred to first actual use.
 */

import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
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
    auth: {
      storage: AsyncStorage,
      persistSession: true,
      autoRefreshToken: true,
      // We don't use email-link / OAuth redirects, so don't parse the URL hash.
      detectSessionInUrl: false,
    },
  });
  return client;
}
