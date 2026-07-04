/**
 * Guest-aware action gate. The app is browsable while signed out (feed, search,
 * ranks, song/album/artist profiles); only actions that need an account — rate,
 * comment, like, follow, drop — go through requireAuth, which runs the action
 * when signed in or bounces a guest to sign-in.
 */

import { useRouter } from 'expo-router';

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
