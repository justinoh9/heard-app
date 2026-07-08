/**
 * Auth context: holds session state, runs the backend, exposes it via useAuth().
 * The active backend is chosen here — swap LocalAuthBackend for a Supabase one
 * later and nothing else changes.
 */

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Platform } from 'react-native';

import { authBackend } from './provider';
import type { OAuthProvider, Session, SignUpInput } from './types';

type Status = 'loading' | 'authed' | 'signedOut';

export interface AuthApi {
  status: Status;
  user: Session['user'] | null;
  signUp: (input: SignUpInput) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  /**
   * Start OAuth sign-in with a provider (Google/Apple/Spotify), or `undefined`
   * when the active backend has no OAuth (LocalAuthBackend) — the sign-in/up
   * screens hide the buttons then. On web the page redirects out; the session
   * lands via onAuthStateChange.
   */
  signInWithOAuth?: (provider: OAuthProvider) => Promise<void>;
}

const AuthContext = createContext<AuthApi | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  // Module singleton (stable reference) — Supabase Auth or Local, chosen by env.
  const backend = authBackend;
  const [session, setSession] = useState<Session | null>(null);
  const [status, setStatus] = useState<Status>('loading');

  useEffect(() => {
    let cancelled = false;
    backend
      .getSession()
      .then((s) => {
        if (cancelled) return;
        setSession(s);
        setStatus(s ? 'authed' : 'signedOut');
      })
      .catch(() => {
        if (!cancelled) setStatus('signedOut');
      });
    // Track changes the app didn't initiate (token expiry/refresh failure,
    // sign-out in another tab) so the UI never thinks it's authed while
    // requests are failing RLS.
    const unsubscribe = backend.onAuthStateChange?.((s) => {
      if (cancelled) return;
      setSession(s);
      setStatus(s ? 'authed' : 'signedOut');
    });
    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, [backend]);

  const api = useMemo<AuthApi>(
    () => ({
      status,
      user: session?.user ?? null,
      signUp: async (input) => {
        const s = await backend.signUp(input);
        setSession(s);
        setStatus('authed');
      },
      signIn: async (email, password) => {
        const s = await backend.signIn(email, password);
        setSession(s);
        setStatus('authed');
      },
      signOut: async () => {
        await backend.signOut();
        setSession(null);
        setStatus('signedOut');
      },
      signInWithOAuth: backend.signInWithOAuth
        ? async (provider) => {
            // Return to the current web origin after consent; native (deep-link)
            // support is a later phase, so leave it undefined off-web for now.
            const redirectTo =
              Platform.OS === 'web' && typeof window !== 'undefined'
                ? window.location.origin
                : undefined;
            await backend.signInWithOAuth!(provider, redirectTo);
            // Success flips to 'authed' via onAuthStateChange after the redirect.
          }
        : undefined,
    }),
    [backend, session, status],
  );

  return <AuthContext.Provider value={api}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthApi {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
