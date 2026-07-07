# Heard — Session Handoff

Working context for continuing development in a new session. For the product
vision see `SPEC.md`, mechanics/data models in `PRODUCT_BLUEPRINT.md`, repo
conventions in `CLAUDE.md`, and the sequenced plan in `ROADMAP.md`.
(Last full refresh: 2026-07-07, Phase 0 stabilization pass.)

## What Heard is
Beli × Letterboxd for music. Rate songs and albums 0–10, break ties with
side-by-side comparisons, build a ranked profile, follow friends, see their
activity in a feed, log concerts, comment and like. Expo (SDK 56) +
expo-router + React Native 0.85 + TypeScript (strict).

## Backend status (the short version)
With `.env` populated, the app runs on a **hosted Supabase project**
(provisioned 2026-07-03): **Supabase Auth** (real accounts, JWT sessions,
`auth.uid()` in RLS), ratings + banked comparisons, profiles + Top 4
favorites, follows + feed events, concerts + tags, comments, likes. RLS is
hardened (`0007`: owner-scoped writes, public reads; `0008`: owner deletes,
insert-only items cache). Music search is live Spotify (Client Credentials;
proxy mode via the `spotify-token` Edge Function is the hardened option), and
the Rate tab's import tray uses per-user Spotify OAuth (PKCE).

Still device-local or in-memory (see ROADMAP Phase 1): streaks (AsyncStorage,
by design), playlists (in-memory, seeded), the Daily Drop (in-memory). Still
mock: leaderboard users, item-page friend/global score breakdowns
(`src/social/scores.ts`), feed filler cards, the comments "friends" roster.

## Architecture — the swappable seams
Screens talk only to interfaces; env presence picks the implementation.
This is the core design principle — keep it.

| Concern | Seam | Supabase impl | Fallback |
|---|---|---|---|
| Auth | `useAuth()` / `AuthBackend` | `SupabaseAuthBackend` | `LocalAuthBackend` |
| Ratings | `useRatings()` / `RatingsBackend` | `SupabaseRatingsBackend` | `LocalRatingsBackend` (AsyncStorage) |
| Social | `useSocial()` / `SocialBackend` | `SupabaseSocialBackend` | AsyncStorage impl |
| Concerts | `useConcerts()` / `ConcertsBackend` | Supabase | AsyncStorage impl |
| Comments | `useComments()` / `CommentsBackend` | Supabase (only impl) | — |
| Likes | `useLikeSummary` / `LikesBackend` | Supabase (only impl) | — |
| Catalog | `MusicCatalog` | — | `SpotifyCatalog` (app token) |
| User library | `UserLibrary` | — | `SpotifyUserLibrary` (user OAuth) |

**Rating engine rule:** the 0–10 score does the coarse sort; comparisons only
break ties within the same score. Every head-to-head is banked to
`comparisons` for a future Elo engine. Every log path emits a feed event and
calls `recordActivity()` (streaks).

## Phase 0 stabilization (done 2026-07-07, this branch)
- `release_year` now selected on ratings load (Wrapped decades survive reload).
- Demo seed (`INITIAL_RANKED`) is local/demo-mode only — cloud users start
  empty, other users' profiles never show it, it's never persisted.
- Guests see like counts (toggling still requires sign-in).
- `AuthProvider` subscribes to `onAuthStateChange` (expiry/multi-tab sign-out).
- `0008_owner_delete.sql`: owner-delete policies (comments, ratings,
  comparisons, concerts, tags, feed events) + items cache made insert-only
  (client upserts with `ignoreDuplicates`). UI: delete own comment (item
  page), remove own rating (profile → ALL RANKED → Edit).
- `setup.sql` / `reset.sql` regenerated to include 0007+0008 (fresh projects
  get hardened RLS).
- Docs refreshed (this file, `CLAUDE.md`).

## Run & verify (Windows)
- `npm run web` — easiest local check (Chrome device toolbar for mobile view).
- `npm test` — 141 unit tests (tsx + node:test). `npx tsc --noEmit` — typecheck.
- Preview MCP server "web" on port 8088 (`.claude/launch.json`).
- `.env` (gitignored) holds Supabase + Spotify keys; Metro inlines
  `EXPO_PUBLIC_*` at bundle start — restart the dev server after edits.

## Gotchas (don't re-hit these)
- Supabase on RN/Hermes needs `react-native-url-polyfill` (already in
  `src/lib/supabase.ts` — don't remove).
- Never import `spotify-auth.ts` from test-reachable modules (pulls
  expo-auth-session, which node tests can't load); singletons wire in
  `src/music/provider.ts`.
- Spotify rejects `localhost` redirect URIs — use `http://127.0.0.1:<port>`
  on web for the OAuth import tray.
- Email confirmation is ON by default in Supabase projects — sign-up shows a
  "confirm your email" message unless disabled (Auth → Providers → Email).
- Typed-routes cache: after adding/moving routes, `expo start --clear` fixes
  stale "Unable to resolve module" errors. Redirect to `'/'`, not `'/(tabs)'`.
- Rows written under old LocalAuthBackend ids are orphaned in the DB —
  readable, unowned; clean via SQL Editor if needed.

## Next
See `ROADMAP.md`. Phase 1 (make the social core real) is next: real
leaderboard aggregates, real score breakdowns, reviews as first-class feed
objects, persistent Daily Drop, playlists → Lists, feed pagination.
