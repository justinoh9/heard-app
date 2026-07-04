/**
 * Supabase Auth backend — real, cloud-hosted accounts (blueprint §3.4). Same
 * `AuthBackend` interface as LocalAuthBackend, so nothing in the UI changes;
 * `provider.ts` picks this one whenever Supabase env is configured.
 *
 * Unlike LocalAuthBackend, identity now lives in Supabase Auth: the session is
 * a real JWT (persisted by the shared client in src/lib/supabase.ts), so
 * `auth.uid()` is available to RLS. `user.id` is the Supabase auth uid, which
 * is what every data seam keys its rows on.
 */

import type { User as SupabaseUser } from '@supabase/supabase-js';

import { getSupabase } from '@/lib/supabase';

import { AuthError, type AuthBackend, type Session, type SignUpInput, type User } from './types';

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** Map a Supabase auth user onto the app's `User` shape. */
function toUser(u: SupabaseUser): User {
  const displayName =
    (u.user_metadata?.display_name as string | undefined)?.trim() ||
    u.email?.split('@')[0] ||
    'listener';
  return {
    id: u.id,
    email: u.email ?? '',
    displayName,
    createdAt: u.created_at ?? new Date().toISOString(),
  };
}

export class SupabaseAuthBackend implements AuthBackend {
  async getSession(): Promise<Session | null> {
    const { data, error } = await getSupabase().auth.getSession();
    if (error) throw new AuthError(error.message);
    const u = data.session?.user;
    return u ? { user: toUser(u) } : null;
  }

  async signUp(input: SignUpInput): Promise<Session> {
    const displayName = input.displayName.trim();
    const email = normalizeEmail(input.email);

    if (!displayName) throw new AuthError('Enter a display name.');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new AuthError('Enter a valid email.');
    if (input.password.length < 6) throw new AuthError('Password must be at least 6 characters.');

    const { data, error } = await getSupabase().auth.signUp({
      email,
      password: input.password,
      // Stored on user_metadata.display_name; read back in toUser().
      options: { data: { display_name: displayName } },
    });
    if (error) throw new AuthError(error.message);

    // No session means the project has email confirmation enabled — the user
    // must click the link before a session exists. Disable it in Supabase
    // (Authentication → Providers → Email → "Confirm email") for instant login.
    if (!data.session) {
      throw new AuthError('Account created — check your email to confirm it, then sign in.');
    }
    return { user: toUser(data.session.user) };
  }

  async signIn(email: string, password: string): Promise<Session> {
    const { data, error } = await getSupabase().auth.signInWithPassword({
      email: normalizeEmail(email),
      password,
    });
    if (error) {
      const msg = error.message?.toLowerCase() ?? '';
      // An unconfirmed account also fails login — tell the user to confirm
      // rather than implying a typo (they'd otherwise keep retrying the password).
      if (msg.includes('not confirmed') || msg.includes('confirm')) {
        throw new AuthError('Confirm your email first — check your inbox for the link, then sign in.');
      }
      // Bad credentials stay opaque (don't leak whether the email exists),
      // matching LocalAuthBackend. Anything else (network, rate limit) surfaces
      // truthfully instead of masquerading as a wrong password.
      if (msg.includes('invalid login') || msg.includes('invalid credentials')) {
        throw new AuthError('Wrong email or password.');
      }
      throw new AuthError(error.message || 'Could not sign in. Try again.');
    }
    if (!data.session) throw new AuthError('Wrong email or password.');
    return { user: toUser(data.session.user) };
  }

  async signOut(): Promise<void> {
    const { error } = await getSupabase().auth.signOut();
    if (error) throw new AuthError(error.message);
  }
}
