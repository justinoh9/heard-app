/**
 * Decides whether a signed-in user should be sent through the onboarding wizard
 * and redirects them once. Fires when: authed, ratings finished loading, the
 * ranked list is empty (a brand-new account), and the on-device onboarded flag
 * isn't set. Called from the tabs layout so it catches every entry into the
 * app regardless of how the user signed up (email or OAuth).
 *
 * Guarded per user so it never loops: the check runs once per userId, and the
 * empty-list + flag conditions both fail after onboarding completes.
 */

import { useRouter } from 'expo-router';
import { useEffect, useRef } from 'react';

import { useAuth } from '@/auth/store';
import { useRatings } from '@/data/store';

import { hasOnboarded } from './flag';

export function useOnboardingRedirect(): void {
  const { user } = useAuth();
  const { ranked, loading } = useRatings();
  const router = useRouter();
  const checkedFor = useRef<string | null>(null);

  useEffect(() => {
    const userId = user?.id;
    if (!userId || loading) return;
    // Only a brand-new (empty) account is a candidate; existing users skip.
    if (ranked.length > 0) {
      checkedFor.current = userId;
      return;
    }
    if (checkedFor.current === userId) return;
    checkedFor.current = userId;

    let cancelled = false;
    hasOnboarded(userId)
      .then((done) => {
        if (!cancelled && !done) router.replace('/onboarding');
      })
      .catch(() => {
        /* flag unreadable — don't block the app, just skip onboarding */
      });
    return () => {
      cancelled = true;
    };
  }, [user?.id, loading, ranked.length, router]);
}
