/**
 * Spotify **user** auth: Authorization Code + PKCE via expo-auth-session.
 *
 * This is separate from the app-level Client Credentials token in `spotify.ts`
 * on purpose (PRODUCT_BLUEPRINT §2.A): catalog search must keep working with
 * zero user login, while `/me/*` endpoints (recently played, top tracks) need a
 * user-authorized token. PKCE needs only the client ID — no secret — so this
 * flow is safe to run entirely on-device.
 *
 * Tokens persist to AsyncStorage (like `src/auth/`), refreshed with the stored
 * refresh token a minute before expiry. Spotify rotates refresh tokens on use,
 * so each refresh re-persists whatever it returns.
 *
 * SETUP: the redirect URI (`redirectUri()`) must be registered in the Spotify
 * app dashboard. Spotify rejects `localhost` — on web, open the dev server via
 * `http://127.0.0.1:<port>` and register exactly that origin.
 *
 * Docs: https://developer.spotify.com/documentation/web-api/tutorials/code-pkce-flow
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';

import { MusicCatalogError } from './types';

// On web the OAuth redirect lands back on the app in a popup; this lets
// expo-auth-session close it and hand the code to the opener. No-op on native.
WebBrowser.maybeCompleteAuthSession();

const DISCOVERY: AuthSession.DiscoveryDocument = {
  authorizationEndpoint: 'https://accounts.spotify.com/authorize',
  tokenEndpoint: 'https://accounts.spotify.com/api/token',
};

/** Read-only user-data scopes for the import tray + future taste profile. */
const SCOPES = ['user-read-recently-played', 'user-top-read', 'user-library-read'];

const TOKENS_KEY = 'heard.spotify.userTokens';
/** Refresh this long before the token actually expires. */
const EXPIRY_MARGIN_MS = 60_000;

export interface StoredSpotifyTokens {
  accessToken: string;
  refreshToken?: string;
  /** Epoch ms after which `accessToken` should not be used. */
  expiresAt: number;
}

/** Pure: shape an expo-auth-session token response for storage. Exported for tests. */
export function toStoredTokens(
  res: Pick<AuthSession.TokenResponse, 'accessToken' | 'refreshToken' | 'expiresIn'>,
  now: number = Date.now(),
  /** Previous refresh token, kept if the response omits one. */
  fallbackRefresh?: string,
): StoredSpotifyTokens {
  return {
    accessToken: res.accessToken,
    refreshToken: res.refreshToken ?? fallbackRefresh,
    expiresAt: now + ((res.expiresIn ?? 3600) * 1000 - EXPIRY_MARGIN_MS),
  };
}

/** Pure: is a stored token still usable at `now`? Exported for tests. */
export function isFresh(tokens: StoredSpotifyTokens, now: number = Date.now()): boolean {
  return now < tokens.expiresAt;
}

export class SpotifyUserAuth {
  /** In-flight refresh, so concurrent callers don't each hit the token endpoint. */
  private pendingRefresh: Promise<string | null> | null = null;

  private get clientId(): string | undefined {
    return process.env.EXPO_PUBLIC_SPOTIFY_CLIENT_ID;
  }

  /** Whether connecting is possible at all (client ID present). */
  isConfigured(): boolean {
    return !!this.clientId;
  }

  /**
   * The redirect URI this device will use — register this exact value in the
   * Spotify dashboard (Settings → Redirect URIs).
   */
  redirectUri(): string {
    return AuthSession.makeRedirectUri();
  }

  private async readTokens(): Promise<StoredSpotifyTokens | null> {
    const raw = await AsyncStorage.getItem(TOKENS_KEY);
    return raw ? (JSON.parse(raw) as StoredSpotifyTokens) : null;
  }

  private async writeTokens(tokens: StoredSpotifyTokens): Promise<void> {
    await AsyncStorage.setItem(TOKENS_KEY, JSON.stringify(tokens));
  }

  /** Whether a user has connected Spotify on this device (token may need refresh). */
  async isConnected(): Promise<boolean> {
    return (await this.readTokens()) !== null;
  }

  /**
   * Run the interactive login (browser popup / app switch). Resolves true on
   * success, false if the user dismissed it. Throws `MusicCatalogError` for
   * configuration or exchange failures so the UI can show the message inline.
   */
  async connect(): Promise<boolean> {
    const clientId = this.clientId;
    if (!clientId) {
      throw new MusicCatalogError(
        'Spotify login isn’t configured. Set EXPO_PUBLIC_SPOTIFY_CLIENT_ID in your .env.',
      );
    }

    const redirectUri = this.redirectUri();
    const request = new AuthSession.AuthRequest({
      clientId,
      scopes: SCOPES,
      usePKCE: true,
      redirectUri,
    });

    const result = await request.promptAsync(DISCOVERY);
    if (result.type !== 'success' || !result.params.code) {
      if (result.type === 'error') {
        throw new MusicCatalogError(
          `Spotify login failed (${result.params.error ?? 'unknown error'}). ` +
            `Check that ${redirectUri} is a registered Redirect URI in the Spotify dashboard.`,
        );
      }
      return false; // dismissed / cancelled
    }

    const tokens = await AuthSession.exchangeCodeAsync(
      {
        clientId,
        code: result.params.code,
        redirectUri,
        extraParams: { code_verifier: request.codeVerifier ?? '' },
      },
      DISCOVERY,
    ).catch(() => {
      throw new MusicCatalogError('Spotify login failed while exchanging the code. Try again.');
    });

    await this.writeTokens(toStoredTokens(tokens));
    return true;
  }

  /** Forget the stored tokens (local disconnect; revocation is in Spotify settings). */
  async disconnect(): Promise<void> {
    await AsyncStorage.removeItem(TOKENS_KEY);
  }

  /**
   * A valid user access token, refreshing behind the scenes if needed.
   * Returns null when not connected (callers show the connect affordance).
   */
  async getAccessToken(): Promise<string | null> {
    const tokens = await this.readTokens();
    if (!tokens) return null;
    if (isFresh(tokens)) return tokens.accessToken;
    if (!this.pendingRefresh) {
      this.pendingRefresh = this.refresh(tokens).finally(() => {
        this.pendingRefresh = null;
      });
    }
    return this.pendingRefresh;
  }

  private async refresh(tokens: StoredSpotifyTokens): Promise<string | null> {
    const clientId = this.clientId;
    if (!clientId || !tokens.refreshToken) {
      await this.disconnect();
      return null;
    }
    try {
      const next = await AuthSession.refreshAsync(
        { clientId, refreshToken: tokens.refreshToken },
        DISCOVERY,
      );
      const stored = toStoredTokens(next, Date.now(), tokens.refreshToken);
      await this.writeTokens(stored);
      return stored.accessToken;
    } catch {
      // Refresh token revoked/expired — drop to disconnected rather than loop.
      await this.disconnect();
      return null;
    }
  }
}

/** Singleton, same pattern as `musicCatalog` in provider.ts. */
export const spotifyUserAuth = new SpotifyUserAuth();
