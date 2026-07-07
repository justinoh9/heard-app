import { useRouter, type Href } from 'expo-router';
import { useCallback } from 'react';

/**
 * A back handler that never dead-ends. `router.back()` is a no-op when there's
 * nothing on the navigation stack to pop — which happens on a hard refresh or
 * deep link straight onto a sub-screen, or after a `router.replace`. In those
 * cases the plain back button leaves the user stuck; this falls back to a
 * sensible route instead.
 *
 * Pass the screen's logical parent as `fallback` (defaults to the Feed home).
 */
export function useGoBack(fallback: Href = '/'): () => void {
  const router = useRouter();
  return useCallback(() => {
    if (router.canGoBack()) router.back();
    else router.replace(fallback);
  }, [router, fallback]);
}
