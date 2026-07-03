/**
 * Spotify token endpoint — a Supabase Edge Function (Deno) that mints a
 * Client-Credentials access token server-side so the client secret never ships
 * in the app bundle. The app calls THIS instead of accounts.spotify.com.
 *
 * Why this exists: `src/music/spotify.ts` can talk to Spotify directly using
 * EXPO_PUBLIC_SPOTIFY_CLIENT_SECRET, but EXPO_PUBLIC_* values are inlined into
 * the client bundle, so that secret is exposed to anyone who downloads the app.
 * Here the secret lives only in the function's environment (a Supabase secret),
 * and the client receives just a short-lived, low-privilege app token.
 *
 * The token the client gets back is a Client-Credentials token: it grants
 * read access to public catalog data (search) only — no user scopes, expires in
 * ~1 hour — so exposing it to the client is acceptable. The secret that mints it
 * is what must stay server-side.
 *
 * Deploy & configure: see README.md in this folder.
 */

const SPOTIFY_TOKEN_URL = 'https://accounts.spotify.com/api/token';

const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

/**
 * Warm-instance cache. Edge Function instances are reused between invocations
 * while warm, so this avoids re-minting a token on every request. It's
 * best-effort (a cold start starts empty), never a correctness dependency.
 */
let cached: { value: string; expiresAt: number } | null = null;

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS });
  }

  const id = Deno.env.get('SPOTIFY_CLIENT_ID');
  const secret = Deno.env.get('SPOTIFY_CLIENT_SECRET');
  if (!id || !secret) {
    return json(
      { error: 'Server is missing SPOTIFY_CLIENT_ID / SPOTIFY_CLIENT_SECRET secrets.' },
      500,
    );
  }

  if (cached && Date.now() < cached.expiresAt) {
    return json({
      access_token: cached.value,
      expires_in: Math.floor((cached.expiresAt - Date.now()) / 1000),
    });
  }

  let res: Response;
  try {
    res = await fetch(SPOTIFY_TOKEN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${btoa(`${id}:${secret}`)}`,
      },
      body: 'grant_type=client_credentials',
    });
  } catch {
    return json({ error: 'Could not reach Spotify.' }, 502);
  }

  if (!res.ok) {
    return json({ error: `Spotify authentication failed (${res.status}).` }, 502);
  }

  const data = (await res.json()) as { access_token?: string; expires_in?: number };
  if (!data.access_token) {
    return json({ error: 'Spotify did not return an access token.' }, 502);
  }

  const expiresIn = data.expires_in ?? 3600;
  // Cache a minute short of real expiry so we never hand out a nearly-dead token.
  cached = { value: data.access_token, expiresAt: Date.now() + (expiresIn - 60) * 1000 };
  return json({ access_token: data.access_token, expires_in: expiresIn });
});
