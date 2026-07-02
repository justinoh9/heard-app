# Heard

A social music-rating app. See `SPEC.md` for the full product spec and rationale,
and `PRODUCT_BLUEPRINT.md` for the feature roadmap (priorities, data models,
build order) that current work follows.

## Stack
- Expo (SDK 56) + expo-router (file-based routing, `src/app/`)
- React Native 0.85, TypeScript (strict)
- Icons: `@expo/vector-icons` (Ionicons)
- Auth and ratings are still local/in-memory (no backend) — mock seed data in
  `src/data/`. Supabase is wired up, but **scoped only to comments and likes**
  (see `src/comments/` and `src/likes/` below); a Supabase auth/ratings
  migration is still planned (SPEC §7).
- Music search runs on the **Spotify Web API** (`src/music/spotify.ts`, Client
  Credentials flow). Two token modes (see `requestToken`): **proxy** — set
  `EXPO_PUBLIC_SPOTIFY_TOKEN_URL` to the `supabase/functions/spotify-token` Edge
  Function so the secret stays server-side (recommended); or **direct** — set
  `EXPO_PUBLIC_SPOTIFY_CLIENT_ID` / `EXPO_PUBLIC_SPOTIFY_CLIENT_SECRET` for a
  zero-backend quick start (the secret then ships in the bundle, same trust
  level as the Supabase anon key). With neither set, search shows a friendly
  "not configured" message instead of crashing.
- Streak state (`src/streaks/`) is the one exception to "ratings are
  in-memory": it persists per-user to `AsyncStorage` (like `src/auth/`),
  because a streak that resets every app reload is meaningless.

## Layout
- `src/app/` — routes. Tabs: `index.tsx` (Feed), `rate.tsx` (Rate),
  `leaderboard.tsx` (Ranks), `profile.tsx`. Plus `log.tsx` (rate/review modal),
  `item/[id].tsx` (public song/album profile + comments + likes), and
  `streak.tsx` (pushed from the Profile streak stat). `_layout.tsx` wraps
  everything in the auth + streaks + ratings + feed + playlists providers.
- `src/ranking/` — the core rating engine.
  - `types.ts` — `Item`, `ItemType`, `RankedItem`, `Comparison`, `ComparisonEvent`.
  - `engine.ts` — `RankingEngine` interface (swappable) + `RatingTiebreakEngine`
    (ships now). Score does the coarse sort; comparisons binary-insert within a tie
    group. See SPEC §5.
  - `engine.test.ts` — unit tests for the tie-break logic.
- `src/data/` — `catalog.ts` (mock songs/feed/profile) and `store.ts` (in-memory
  ratings store + `useRatings()` hook). This is the seam the backend replaces.
- `src/auth/` — `useAuth()`/`AuthBackend` seam; `LocalAuthBackend` ships now
  (AsyncStorage + expo-crypto).
- `src/music/` — `MusicCatalog` seam; `SpotifyCatalog` (`spotify.ts`) ships now
  (album + track search in one request, popularity-ranked tracks, cached app
  token). `cover-art.ts` builds Cover Art Archive URLs — used only by the mock
  seed data (`catalog.ts`, `seed.ts`), independent of live search.
  Also the **`UserLibrary` seam** (`user-library.ts`) — the viewer's own Spotify
  data (recently played / top tracks / top artists) via **user OAuth**
  (`spotify-auth.ts`, Authorization Code + PKCE, client-ID-only, tokens in
  AsyncStorage). Kept separate from `MusicCatalog` so search never needs a user
  login. Singletons wire up in `provider.ts` (never import `spotify-auth.ts`
  from test-reachable modules — it pulls expo-auth-session, which node tests
  can't load). Powers the Rate tab's "Recently played" import tray
  (`src/components/recent-plays-tray.tsx`) — an *active-log* on-ramp: imported
  plays are candidates, never auto-logged (PRODUCT_BLUEPRINT §2.A). Requires the
  device's redirect URI registered in the Spotify dashboard; Spotify rejects
  `localhost`, so on web use `http://127.0.0.1:<port>`.
- `src/comments/` — `CommentsBackend` seam; `SupabaseCommentsBackend` is the
  only implementation (ships Supabase-backed from day one — see "Comments,
  likes & Supabase" below).
- `src/likes/` — `LikesBackend` seam, same Supabase-backed-from-day-one
  treatment as comments. One generic `likes` table (discriminated by
  `target_type`) covers both item likes (song/album profile) and comment likes.
- `src/streaks/` — pure day-boundary logic (`logic.ts`) + an `AsyncStorage`-backed
  `useStreaks()` store. `commitPlacement` (`src/data/store.ts`) and `postDrop`
  (`src/feed/store.tsx`) both call `recordActivity()` directly.
- `src/lib/supabase.ts` — the Supabase client singleton, used by
  `src/comments/` and `src/likes/`.
- `src/components/`, `src/constants/theme.ts`, `src/hooks/` — shared UI
  primitives (`ThemedText`, `ThemedView`, `EmptyState`, `Skeleton`,
  `CommentCard`, `useTheme`, `useHaptics`, `Colors`, `Spacing`).

## Commands
- `npm run web` — run in browser (easiest local check on Windows)
- `npm start` — Expo dev server (scan QR with Expo Go for a phone)
- `npm test` — run ranking + music + streaks + likes unit tests (tsx + node:test)
- `npx tsc --noEmit` — typecheck

## Conventions
- Keep screens talking only to `useRatings()` and the `RankingEngine` interface —
  never reach past them into engine internals, so the engine stays swappable.
- Every head-to-head is logged to `comparisonLog` even though the current engine
  only needs final order — that banked data enables a future Elo engine (SPEC §5).

## Comments, likes & Supabase
Comments and likes are the pieces of this app backed by a real, hosted
database — everything else (auth, ratings) is still local/in-memory. This is a
deliberate, narrow scope, not a first step in a broader migration that's
already underway.

- **Setup required**: copy `.env.example` to `.env` and fill in
  `EXPO_PUBLIC_SUPABASE_URL` / `EXPO_PUBLIC_SUPABASE_ANON_KEY` from a Supabase
  project (Project Settings → API). Without these, `src/lib/supabase.ts`
  throws at module load — search/rating still work, only comments and likes
  break. (The same `.env` also holds the Spotify keys that power search — see
  the Stack section.)
- Run `supabase/migrations/0001_comments.sql` and `0002_likes.sql` in the
  project's SQL Editor to create the `comments` and `likes` tables.
- **Known trust gap**: auth is `LocalAuthBackend`, not Supabase Auth, so RLS
  cannot cryptographically verify who's posting a comment or toggling a like.
  Both tables' RLS policies allow public read and trust client-supplied
  `user_id` (comments also trust `display_name`) on insert/delete — the same
  trust level as the rest of this prototype. Revisit if auth ever migrates to
  Supabase Auth.
