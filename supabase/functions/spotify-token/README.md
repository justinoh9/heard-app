# `spotify-token` Edge Function

Mints a Spotify **Client-Credentials** access token server-side so the Spotify
client **secret never ships in the app bundle**. Once deployed, the app fetches
its token from here instead of calling `accounts.spotify.com` directly (see
`src/music/spotify.ts` → proxy mode).

## Why

`EXPO_PUBLIC_*` env vars are inlined into the client bundle, so putting
`EXPO_PUBLIC_SPOTIFY_CLIENT_SECRET` there exposes the secret to anyone who
downloads the app. This function keeps the secret in the server environment and
returns only a short-lived, read-only app token (no user scopes, ~1h TTL).

## Deploy

Requires the [Supabase CLI](https://supabase.com/docs/guides/cli) and a linked
project (`supabase link --project-ref <ref>`).

```bash
# 1. Store the Spotify credentials as function secrets (NOT EXPO_PUBLIC_*).
supabase secrets set SPOTIFY_CLIENT_ID=xxxxxxxx SPOTIFY_CLIENT_SECRET=yyyyyyyy

# 2. Deploy.
supabase functions deploy spotify-token
```

The function URL is:

```
https://<project-ref>.supabase.co/functions/v1/spotify-token
```

## Point the app at it

In the app's `.env`:

```
EXPO_PUBLIC_SPOTIFY_TOKEN_URL=https://<project-ref>.supabase.co/functions/v1/spotify-token
# Remove EXPO_PUBLIC_SPOTIFY_CLIENT_SECRET — it's no longer needed client-side.
# Keep EXPO_PUBLIC_SUPABASE_ANON_KEY set (sent as the caller's key, below).
```

Then restart the dev server (`npm start -- --clear`) so Expo re-inlines the env.

## Auth on the endpoint

By default Supabase Edge Functions require a valid Supabase JWT. The app sends
its **anon key** (`EXPO_PUBLIC_SUPABASE_ANON_KEY`) as both the `apikey` and
`Authorization: Bearer` headers, which satisfies this — so only clients holding
your anon key (i.e. your app) can mint tokens. The anon key is already in the
bundle, so this adds no new secret.

If you'd rather make the endpoint fully public, deploy with
`supabase functions deploy spotify-token --no-verify-jwt`; the app's headers are
harmless either way.

## Further hardening (optional)

This endpoint vends a token to the client. To keep even the token off the
client, move the whole search server-side (a `spotify-search` function that
proxies `GET /v1/search` and returns mapped results). `src/music/spotify.ts`'s
parse functions could then run in the function instead. Not necessary for the
current threat model — the Client-Credentials token is low-privilege — but it's
the next step if you want zero Spotify material in the bundle.
