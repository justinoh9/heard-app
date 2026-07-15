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

import {
  AuthError,
  type AuthBackend,
  type OAuthProvider,
  type Session,
  type SignUpInput,
  type User,
} from './types';

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * "The thing you asked me to delete isn't there" — which, for a delete, is the
 * outcome we wanted. Matched on the message because supabase-js's StorageError
 * doesn't carry a stable code for these, and the alternative (treating every
 * error as fatal) would trap a user with no avatar inside an account they asked
 * to close.
 */
function isMissingStorageTarget(message: string): boolean {
  const m = message.toLowerCase();
  return m.includes('not found') || m.includes('does not exist');
}

/** Map a Supabase auth user onto the app's `User` shape. */
function toUser(u: SupabaseUser): User {
  // Email/password sets display_name; OAuth providers (Google/Spotify) populate
  // the profile under full_name/name instead — check all three before the email.
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

  async signInWithOAuth(provider: OAuthProvider, redirectTo?: string): Promise<void> {
    const { error } = await getSupabase().auth.signInWithOAuth({
      provider,
      options: {
        // Where Supabase sends the browser back to after the provider consents.
        // Must be on the project's redirect allowlist (Auth → URL Configuration).
        redirectTo,
        // Spotify needs an explicit email scope (and it lets accounts auto-link
        // to an existing email/password identity); Google/Apple return email by
        // default, so only ask Spotify for it.
        scopes: provider === 'spotify' ? 'user-read-email' : undefined,
      },
    });
    // On web this rarely returns (the page has already navigated out). If it
    // errors first — e.g. the provider isn't enabled in the Supabase dashboard —
    // surface it.
    if (error) throw new AuthError(error.message || 'Could not start sign-in.');
  }

  async signOut(): Promise<void> {
    const { error } = await getSupabase().auth.signOut();
    if (error) throw new AuthError(error.message);
  }

  /**
   * Deletes the account server-side via the `delete_own_account()` RPC
   * (`0020_account_deletion.sql`) — a SECURITY DEFINER function, because
   * removing the `auth.users` row needs privileges this client doesn't have and
   * must never have. The function takes no arguments and derives the target from
   * `auth.uid()`, so the client cannot name a victim.
   */
  /**
   * Remove the user's avatar through the Storage API.
   *
   * This used to be a `delete from storage.objects` inside delete_own_account(),
   * which never worked: Supabase puts a `storage.protect_delete()` trigger on
   * those tables that rejects direct DML ("Use the Storage API instead"). The
   * whole deletion failed on that line, every time.
   *
   * It runs BEFORE the RPC on purpose. The bucket's RLS scopes objects to their
   * owner (`<uid>/avatar.<ext>`, 0015), so authorization to delete the file dies
   * with the account — do it after and the photo is orphaned, public, forever.
   *
   * "Nothing to delete" is success, not failure: a user with no avatar, or a
   * project that never ran 0015, must still be able to close their account.
   * Anything else throws, so the caller retries the whole flow with the account
   * intact rather than leaving a photo of someone who asked to be erased.
   */
  private async removeAvatar(userId: string): Promise<void> {
    const supabase = getSupabase();
    const bucket = supabase.storage.from('avatars');

    const listed = await bucket.list(userId);
    if (listed.error) {
      if (isMissingStorageTarget(listed.error.message)) return;
      throw new AuthError(`Could not check your avatar: ${listed.error.message}`);
    }
    if (!listed.data?.length) return;

    // The extension varies (0015 stores `<uid>/avatar.<ext>`), so remove whatever
    // is actually in the folder rather than guessing at the name.
    const paths = listed.data.map((f) => `${userId}/${f.name}`);
    const removed = await bucket.remove(paths);
    if (removed.error && !isMissingStorageTarget(removed.error.message)) {
      throw new AuthError(`Could not delete your avatar: ${removed.error.message}`);
    }
  }

  async deleteAccount(): Promise<void> {
    const supabase = getSupabase();

    // Needs the uid before the account is gone, and from the server rather than
    // from local state — deleting the wrong user's avatar is unrecoverable.
    const { data, error: userError } = await supabase.auth.getUser();
    if (userError || !data.user) throw new AuthError('You need to be signed in to delete your account.');
    await this.removeAvatar(data.user.id);

    const { error } = await supabase.rpc('delete_own_account');
    if (error) throw new AuthError(error.message);

    // The account is already gone; this just clears the now-dead session from
    // local storage. Deleting auth.users cascades to sessions/refresh_tokens,
    // so a failure here means a stale local token for a user that no longer
    // exists — worth not surfacing as a failed deletion.
    await supabase.auth.signOut().catch(() => {});
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
