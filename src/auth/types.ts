/**
 * Authentication seam. See SPEC.md §7 — Supabase Auth is the planned backend.
 * Screens talk only to this interface (via `useAuth`), so swapping the local
 * implementation for `SupabaseAuthBackend` later doesn't touch any UI.
 */

export interface User {
  id: string;
  email: string;
  displayName: string;
  createdAt: string;
}

export interface Session {
  user: User;
}

export interface SignUpInput {
  displayName: string;
  email: string;
  password: string;
}

/** Third-party identity providers wired through Supabase Auth's OAuth flow. */
export type OAuthProvider = 'spotify' | 'google' | 'apple';

/** Thrown for expected, user-facing failures (e.g. wrong password). */
export class AuthError extends Error {}

export interface AuthBackend {
  /** Restore a persisted session on app launch, or null if signed out. */
  getSession(): Promise<Session | null>;
  signUp(input: SignUpInput): Promise<Session>;
  signIn(email: string, password: string): Promise<Session>;
  signOut(): Promise<void>;
  /**
   * Optional: begin an OAuth sign-in with a third-party provider (Google/Apple/
   * Spotify). On web this redirects the page out to the provider and resolves as
   * navigation starts — the authed session arrives afterwards via
   * `onAuthStateChange` (not from this promise). `redirectTo` is the URL the
   * provider/Supabase returns to (the app origin on web). Backends without OAuth
   * (LocalAuthBackend) omit this, and the UI hides the buttons.
   */
  signInWithOAuth?(provider: OAuthProvider, redirectTo?: string): Promise<void>;
  /**
   * Optional: notify on session changes the app didn't initiate — token
   * refresh failure/expiry, sign-out in another tab. Returns an unsubscribe.
   * LocalAuthBackend has no external session source, so it omits this.
   */
  onAuthStateChange?(callback: (session: Session | null) => void): () => void;
  /**
   * Permanently delete the signed-in account and everything it owns, then end
   * the session. Irreversible, and required in-app by Apple for any app that
   * offers sign-up (ROADMAP G5) — "email support to delete" doesn't qualify.
   *
   * Not optional on the interface: an auth backend that can create accounts but
   * can't delete them is the exact gap this closes, so a future backend has to
   * answer for it rather than silently omit it.
   */
  deleteAccount(): Promise<void>;
}
