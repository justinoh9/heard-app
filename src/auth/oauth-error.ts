/**
 * Handling for OAuth **redirect errors** — when a provider (Spotify) or Supabase
 * bounces the web app back to the origin with `?error=...` instead of a session.
 * Without this the app just lands on the Feed and the failure looks like nothing
 * happened. The root layout parses the error off the URL during render (before
 * the Supabase client can strip it), stashes it here, and the sign-in screen
 * reads + displays it.
 *
 * Spotify user data (login profile included) is gated behind Development Mode's
 * tiny allowlist unless the app has Extended Quota — which needs a registered
 * business with 250k+ MAU. So for ~every public visitor, "Log in with Spotify"
 * fails with "Error getting user profile from external provider"; friendlyMessage
 * turns that into an actionable nudge toward email sign-up.
 */

export interface OAuthErrorInfo {
  /** e.g. 'server_error' / 'access_denied'. */
  error: string;
  /** e.g. 'unexpected_failure'. */
  code?: string;
  /** Raw, URL-decoded description from the provider. */
  description?: string;
}

/**
 * Pure: pull an OAuth error out of a URL's query and/or hash (Supabase writes it
 * to both). Returns null for a normal URL. Exported for tests.
 */
export function parseOAuthError(url: string): OAuthErrorInfo | null {
  const params = new URLSearchParams();
  const q = url.indexOf('?');
  const h = url.indexOf('#');
  const add = (frag: string) => {
    for (const [k, v] of new URLSearchParams(frag)) params.set(k, v);
  };
  if (q >= 0) add(url.slice(q + 1, h > q ? h : undefined));
  if (h >= 0) add(url.slice(h + 1));

  const error = params.get('error');
  const description = params.get('error_description') ?? undefined;
  if (!error && !description) return null;
  return { error: error ?? 'error', code: params.get('error_code') ?? undefined, description };
}

/** Pure: a user-facing message for an OAuth error. Exported for tests. */
export function friendlyMessage(info: OAuthErrorInfo): string {
  const hay = `${info.error} ${info.code ?? ''} ${info.description ?? ''}`.toLowerCase();
  // Spotify blocks profile/API access for non-allowlisted users in dev mode.
  if (
    hay.includes('user profile') ||
    hay.includes('external provider') ||
    hay.includes('unexpected_failure')
  ) {
    return 'Spotify sign-in isn’t open during our beta yet — please sign up with email instead.';
  }
  if (hay.includes('access_denied')) {
    return 'Spotify sign-in was cancelled. You can sign up with email instead.';
  }
  return info.description || 'Sign-in failed. Please try again, or use email.';
}

// --- one-shot handoff from the root layout to the sign-in screen ---
let pending: OAuthErrorInfo | null = null;

export function setPendingOAuthError(info: OAuthErrorInfo | null): void {
  pending = info;
}

/** Is an error waiting? Non-destructive (the root layout uses this to redirect). */
export function peekPendingOAuthError(): boolean {
  return pending !== null;
}

/** Read and clear the pending error (the sign-in screen consumes it once). */
export function takePendingOAuthError(): OAuthErrorInfo | null {
  const info = pending;
  pending = null;
  return info;
}
