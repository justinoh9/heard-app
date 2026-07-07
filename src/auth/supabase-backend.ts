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
  // Email/password sets display_name; Spotify OAuth populates the profile under
  // full_name/name instead — check all three before falling back to the email.
  const meta = u.user_metadata ?? {};
  const displayName =
    (meta.display_name as string | undefined)?.trim() ||
    (meta.full_name as string | undefined)?.trim() ||
    (meta.name as string | undefined)?.trim() ||
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

  async signInWithSpotify(redirectTo?: string): Promise<void> {
    const { error } = await getSupabase().auth.signInWithOAuth({
      provider: 'spotify',
      options: {
        // Where Supabase sends the browser back to after Spotify consents. Must
        // be on the project's redirect allowlist (Auth → URL Configuration).
        redirectTo,
        // Ask for the email so accounts have one (and can auto-link to an
        // existing email/password identity with the same verified address).
        scopes: 'user-read-email',
      },
    });
    // On web this rarely returns (the page has already navigated to Spotify);
    // if it does error before redirecting, surface it.
    if (error) throw new AuthError(error.message || 'Could not start Spotify sign-in.');
  }

  async signOut(): Promise<void> {
    const { error } = await getSupabase().auth.signOut();
    if (error) throw new AuthError(error.message);
  }

  onAuthStateChange(callback: (session: Session | null) => void): () => void {
    // Only setState in here — supabase-js warns that awaiting its own calls
    // inside this callback can deadlock.
    const { data } = getSupabase().auth.onAuthStateChange((_event, session) => {
      const u = session?.user;
      callback(u ? { user: toUser(u) } : null);
    });
    return () => data.subscription.unsubscribe();
  }
}
