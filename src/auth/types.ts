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

/** Thrown for expected, user-facing failures (e.g. wrong password). */
export class AuthError extends Error {}

export interface AuthBackend {
  /** Restore a persisted session on app launch, or null if signed out. */
  getSession(): Promise<Session | null>;
  signUp(input: SignUpInput): Promise<Session>;
  signIn(email: string, password: string): Promise<Session>;
  signOut(): Promise<void>;
  /**
   * Optional: notify on session changes the app didn't initiate — token
   * refresh failure/expiry, sign-out in another tab. Returns an unsubscribe.
   * LocalAuthBackend has no external session source, so it omits this.
   */
  onAuthStateChange?(callback: (session: Session | null) => void): () => void;
}
