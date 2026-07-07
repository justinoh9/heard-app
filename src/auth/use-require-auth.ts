/**
 * Guest-aware auth helpers. The app is browsable while signed out (feed, search,
 * ranks, song/album/artist profiles); only actions that need an account — rate,
 * comment, like, follow, drop, log a show — are gated.
 *
 * - useRequireAuth(): wrap an action so it runs when signed in, else routes the
 *   guest to sign-in (for inline buttons).
 * - useAuthGate(): a whole-screen guard for account-only routes, so a guest who
 *   deep-links straight to one is redirected instead of seeing a dead form.
 */

import { useRouter } from 'expo-router';
import { useEffect } from 'react';

import { useAuth } from './store';

export function useRequireAuth() {
  const { user } = useAuth();
  const router = useRouter();

  function requireAuth(action: () => void): void {
    if (user) action();
    else router.push('/(auth)/sign-in');
  }

  return { user, isGuest: !user, requireAuth };
}

/**
 * Guard an account-only screen. A signed-out visitor is redirected to sign-in
 * on mount. Returns the user so a caller can `if (!user) return null` after its
 * other hooks to avoid briefly flashing the gated content.
 */
export function useAuthGate() {
  const { user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!user) router.replace('/(auth)/sign-in');
  }, [user, router]);

  return user;
}
