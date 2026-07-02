# Heard

A social music-rating app. See `SPEC.md` for the full product spec and rationale,
and `PRODUCT_BLUEPRINT.md` for the feature roadmap (priorities, data models,
build order) that current work follows.

## Stack
- Expo (SDK 56) + expo-router (file-based routing, `src/app/`)
- React Native 0.85, TypeScript (strict)
- Icons: `@expo/vector-icons` (Ionicons)
- Auth is still local (no backend) — `LocalAuthBackend` in `src/auth/`.
  **Ratings persist** behind the `RatingsBackend` seam (`src/data/`):
  `SupabaseRatingsBackend` when Supabase env vars are set
  (`supabase/migrations/0003_ratings.sql` — items/ratings/comparisons),
  else an AsyncStorage `LocalRatingsBackend` fallback, so ratings survive
  reloads with zero config. Mock seed data in `src/data/catalog.ts` seeds
  brand-new users. A Supabase Auth migration is still planned
  (PRODUCT_BLUEPRINT §3.4).
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
    group. Escape hatches on `Placement`: `skip()` ("haven't heard it" — opponent
    keeps its slot) and `tooClose()` (settle below the opponent); neither logs a
    comparison event. See SPEC §5.
  - `nudge.ts` — the re-rank "quick match" (blueprint §2.B): picks an adjacent
    never-compared pair (same-score pairs preferred — those can actually swap;
    cross-score answers are banked only). Rendered by
    `src/components/quick-match-card.tsx` at the top of the Ranks tab, applied
    through `commitPlacement`.
  - `engine.test.ts`, `nudge.test.ts` — unit tests for tie-break + nudge logic.
- `src/data/` — `catalog.ts` (mock songs/feed/profile), `store.ts`
  (`useRatings()` hook: hydrates from the backend on sign-in, optimistic
  commits), `ratings-backend.ts` (`RatingsBackend` interface +
  `LocalRatingsBackend`), `supabase-ratings-backend.ts`, and
  `ratings-rows.ts` (pure row↔model mapping, unit-tested).
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
- `src/social/` — the follow graph + activity feed (`useSocial()` in
  `store.tsx`; `SocialBackend` seam with Supabase/AsyncStorage impls, chosen in
  `provider.ts` like ratings). `feed-rows.ts` is the pure, unit-tested mapping.
  **Every log path emits a feed event** (blueprint §1.3): `commitPlacement`
  publishes `rated`, `postDrop` publishes `drop`. `src/app/people.tsx` is the
  directory with follow toggles; the Feed tab renders real events above the
  mock "From the community" filler. `compatibility.ts` is the pure taste-match
  algorithm (blueprint §2.C) shown on `src/app/user/[id].tsx` — another user's
  profile (% match + shared favorites + their ranked list via
  `ratingsBackend.load`), reached from People rows and feed avatars.
  `favorites.ts` resolves the **Top 4 showcase** (blueprint §2.D): chosen ids
  live on `Profile.favorites` (`0005_favorites.sql`; `saveFavorites` in the
  store), edited on the Profile tab (Edit → remove/add via picker sheet, with
  a top-of-ranked fallback until chosen) and shown on `/user/[id]`.
  `scores.ts` (mock friend-score chrome) predates this and still backs the
  item page's fake breakdowns.
- `src/concerts/` — live show logging (blueprint §2.C, the "map" mechanic):
  `useConcerts()` in `store.tsx`, `ConcertsBackend` seam (Supabase
  `0006_concerts.sql` / AsyncStorage, chosen in `provider.ts`), pure
  `rows.ts` (unit-tested). Logged via `src/app/concert/new.tsx` (modal:
  artist/venue/date/score + friend-tag chips); tagged friends see the show on
  their own profile (`concertsFor`). Publishes a `'concert'` feed event; the
  Profile tab's SHOWS badges + shows stat and the leaderboard's concerts
  metric are real counts now.
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
- Run `supabase/migrations/0001_comments.sql` through `0006_concerts.sql` in
  the project's SQL Editor to create the `comments`, `likes`, `items`,
  `ratings`, `comparisons`, `profiles`, `follows`, `feed_events`, `concerts`,
  and `concert_tags` tables.
- **Known trust gap**: auth is `LocalAuthBackend`, not Supabase Auth, so RLS
  cannot cryptographically verify who's posting a comment or toggling a like.
  Both tables' RLS policies allow public read and trust client-supplied
  `user_id` (comments also trust `display_name`) on insert/delete — the same
  trust level as the rest of this prototype. Revisit if auth ever migrates to
  Supabase Auth.
