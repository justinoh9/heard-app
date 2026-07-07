import { useCallback, useEffect, useState } from 'react';

import { MusicCatalogError, userLibrary } from '@/music';

export type SpotifyConnectionStatus = 'checking' | 'connected' | 'disconnected';

/**
 * Shared Spotify user-connection state for every surface that links the account
 * (the Rate tab's import tray, the Settings connections row). Both read and
 * write the same device-local `userLibrary` tokens, so they never drift.
 *
 * Connection is per-device (AsyncStorage, see spotify-auth.ts), so each mount
 * re-checks `isConnected()` rather than trusting a global cache. `refresh()`
 * lets a caller re-sync after an API call self-disconnects on a 401.
 */
export function useSpotifyConnection() {
  const configured = userLibrary.isConfigured();
  const [status, setStatus] = useState<SpotifyConnectionStatus>(
    configured ? 'checking' : 'disconnected',
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!configured) return;
    setStatus((await userLibrary.isConnected()) ? 'connected' : 'disconnected');
  }, [configured]);

  useEffect(() => {
    let alive = true;
    if (!configured) return;
    userLibrary.isConnected().then((connected) => {
      if (alive) setStatus(connected ? 'connected' : 'disconnected');
    });
    return () => {
      alive = false;
    };
  }, [configured]);

  /** Interactive login. Resolves true on success, false if dismissed/failed. */
  const connect = useCallback(async (): Promise<boolean> => {
    setBusy(true);
    setError(null);
    try {
      const ok = await userLibrary.connect();
      if (ok) setStatus('connected');
      return ok;
    } catch (e) {
      setError(e instanceof MusicCatalogError ? e.message : 'Spotify login failed.');
      return false;
    } finally {
      setBusy(false);
    }
  }, []);

  const disconnect = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      await userLibrary.disconnect();
      setStatus('disconnected');
    } finally {
      setBusy(false);
    }
  }, []);

  return { configured, status, busy, error, connect, disconnect, refresh };
}
