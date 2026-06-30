/**
 * Auth context: holds session state, runs the backend, exposes it via useAuth().
 * The active backend is chosen here — swap LocalAuthBackend for a Supabase one
 * later and nothing else changes.
 */

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { LocalAuthBackend } from './local-backend';
import type { AuthBackend, Session, SignUpInput } from './types';

type Status = 'loading' | 'authed' | 'signedOut';

export interface AuthApi {
  status: Status;
  user: Session['user'] | null;
  signUp: (input: SignUpInput) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthApi | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const backend = useMemo<AuthBackend>(() => new LocalAuthBackend(), []);
  const [session, setSession] = useState<Session | null>(null);
  const [status, setStatus] = useState<Status>('loading');

  useEffect(() => {
    backend
      .getSession()
      .then((s) => {
        setSession(s);
        setStatus(s ? 'authed' : 'signedOut');
      })
      .catch(() => setStatus('signedOut'));
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
