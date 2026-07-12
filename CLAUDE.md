# Heard

A social music-rating app. See `SPEC.md` for the full product spec and rationale,
`PRODUCT_BLUEPRINT.md` for the mechanics + data models, and `ROADMAP.md` for the
sequenced plan current work follows (Phase 0 = stabilization, then social-core,
retention, differentiators).

## Stack
- Expo (SDK 56) + expo-router (file-based routing, `src/app/`)
- React Native 0.85, TypeScript (strict)
- Icons: `@expo/vector-icons` (Ionicons)
- **Auth is Supabase Auth** when the Supabase env vars are set
  (`SupabaseAuthBackend` behind the `AuthBackend` seam, chosen in
  `src/auth/provider.ts`; `user.id` is the auth uid, so `auth.uid()` works in
  RLS). Zero-config checkouts fall back to the on-device `LocalAuthBackend`.
  **Ratings persist** behind the `RatingsBackend` seam (`src/data/`):
  `SupabaseRatingsBackend` when configured
  (`supabase/migrations/0003_ratings.sql` — items/ratings/comparisons),
  else an AsyncStorage `LocalRatingsBackend` fallback. Mock seed data in
  `src/data/catalog.ts` seeds brand-new users **in local/demo mode only** —
  against the cloud backend a new user starts empty, so demo ratings are never
  persisted as real data.
- Music search runs on the **iTunes Search API** (`src/music/itunes.ts`) —
  keyless, no backend, no secret in the bundle. Reflective CORS (Apple echoes
  the request origin) makes direct `fetch` work on web; native has no CORS. It
  returns real artwork (the 100px thumbnail URL is upscaled to 600px in
  `upscaleArtwork`) and working 30s previews. The one gap — no popularity
  signal — is filled **best-effort** by Last.fm listener counts
  (`src/music/lastfm.ts`, the `PopularityEnricher` seam): song results get a
  log-scaled 0-100 `popularity` and are re-ranked when `EXPO_PUBLIC_LASTFM_API_KEY`
  is set; without it they keep Apple's relevance order. `searchAll` fans out
  album + song requests in parallel and *derives* artist rows from them (iTunes
  has no artist objects with art), ordered by how often each artist recurs so
  the intended artist wins the "Top result" slot. Artist *photos* (which iTunes
  also lacks) come from **Deezer** (`src/music/deezer.ts`, `ArtistImageProvider`
  seam) on the artist-page hero; Deezer's JSON API blocks browser CORS, so the
  transport (`deezer-request.ts`, app-only) uses JSONP on web / fetch on native
  — the returned CDN image renders fine either way. `src/music/spotify.ts` is
  retained as an alternate `MusicCatalog` and still backs the user-library
  import (the separate Spotify user-OAuth for "recently played").
- Streak state (`src/streaks/`) persists per-user to `AsyncStorage` on the
  device (deliberately not in Supabase — it's a per-device habit nudge).
- The **Daily Drop** persists behind a `DropsBackend` seam (`src/feed/`):
  `SupabaseDropsBackend` (`0009_drops.sql` — one active row per user, upserted
  on re-post) or an AsyncStorage `LocalDropsBackend`, chosen in
  `src/feed/provider.ts`. Pure `rows.ts` (unit-tested) owns the 24h expiry;
  the feed card shows a real countdown (`formatDropRemaining`). The store
  (`src/feed/store.tsx`) hydrates the viewer's active drop on sign-in and
  writes optimistically.
- **Playlists persist as Lists** behind a `ListsBackend` seam
  (`src/playlists/`): `SupabaseListsBackend` (`0010_lists.sql` —
  `lists`/`list_items`, the client module stays named "playlists") or an
  AsyncStorage `LocalListsBackend` (which seeds the demo lists for a new local
  user), chosen in `src/playlists/provider.ts`. Ids are client-generated so
  `createPlaylist` returns synchronously for navigation; creating a list
  publishes a `made_list` feed event.

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
  `LocalRatingsBackend`), `supabase-ratings-backend.ts`,
  `ratings-rows.ts` (pure row↔model mapping, unit-tested), and `stats.ts`
  (pure Wrapped rollup — histogram / top artists / decades / top venue —
  rendered by `src/app/wrapped.tsx`, pushed from the Profile tab's "Your
  Wrapped" card). `Item.year` powers the decades; the log flow threads it
  from search params and `items.release_year` persists it.
- `src/taste/` — the taste profile (ROADMAP Phase 2): `profile.ts`
  (`computeTasteProfile`, pure + unit-tested) reuses `computeStats` for
  artists/decades/mean and adds a `ratingStyle` descriptor (Generous / Critical
  / Balanced / Polarizing / Getting started, from mean + histogram). Rendered by
  the reusable `components/taste-profile-card.tsx` on the Profile tab and
  `/user/[id]` (it also retired the fake `PROFILE.tags` line). No genres yet —
  iTunes carries no persisted genre; that section waits on a genre pipeline or
  Spotify artist genres (see ROADMAP).
- `src/auth/` — `useAuth()`/`AuthBackend` seam; `SupabaseAuthBackend` (real
  accounts, session persisted by the shared client, `onAuthStateChange`
  tracked) or `LocalAuthBackend` (AsyncStorage + expo-crypto) chosen by env in
  `provider.ts`. `use-require-auth.ts` gates account-only actions/screens;
  browsing is open to guests (`GuestGate` for personal surfaces).
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
  publishes `rated`, `postDrop` publishes `drop`, `createPlaylist` publishes
  `made_list`. The feed pages backward via `feedFor(userIds, limit, before)`
  (cursor = the oldest event held); the store exposes `loadMoreFeed` +
  `feedHasMore`. `src/app/people.tsx` is the directory with follow toggles; the
  Feed tab renders real events, and the mock "From the community" filler shows
  **only on the cold-start empty feed** (never stacked under real activity —
  ROADMAP goal #4). The comments "friends" filter (`src/comments/filter.ts`)
  now takes the real followed-user name set, not a mock roster. `compatibility.ts` is the pure taste-match
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
  only implementation (Supabase-backed from day one — see "Supabase" below).
  Users can delete their own comments (trash icon on the item page).
- `src/likes/` — `LikesBackend` seam, same Supabase-backed-from-day-one
  treatment as comments. One generic `likes` table (discriminated by
  `target_type`) covers both item likes (song/album profile) and comment likes.
- `src/onboarding/` — the new-user wizard (`src/app/onboarding.tsx`), the
  biggest D1-retention lever (ROADMAP Phase 2). `useOnboardingRedirect` (called
  from `(tabs)/_layout.tsx`) sends a signed-in user with an empty ranked list
  and no `flag.ts` onboarded mark to `/onboarding`: welcome → rapid-rate curated
  albums (`seed.ts` — live catalog search with an MBID fallback) → follow
  taste-matched people (`suggestions.ts`, pure + tested, over `compatibility`) →
  done. Ratings persist through `commitPlacement` (no per-item feed spam). The
  seed is deliberately catalog-based, not Spotify top-tracks (Spotify OAuth is
  allowlist-gated) — see ROADMAP.
- `src/streaks/` — pure day-boundary logic (`logic.ts`) + an `AsyncStorage`-backed
  `useStreaks()` store. `commitPlacement` (`src/data/store.ts`) and `postDrop`
  (`src/feed/store.tsx`) both call `recordActivity()` directly.
- `src/lib/supabase.ts` — the Supabase client singleton (session persistence
  on), used by the auth, ratings, social, concerts, comments, and likes seams.
- `src/components/`, `src/constants/theme.ts`, `src/hooks/` — shared UI
  primitives (`ThemedText`, `ThemedView`, `EmptyState`, `Skeleton`,
  `CommentCard`, `useTheme`, `useHaptics`, `Spacing`).
  **Theming:** `constants/theme.ts` defines named `Palettes` (`vinyl` — the
  default dark-crimson look — and `cream`, warm paper) with accent tokens
  (`accent`/`onAccent`/`accentSoft`/`accentAlt`/`danger`/`warning`).
  `useTheme()` reads the selected palette from `ThemePreferenceContext`
  (persisted to AsyncStorage, picker in Settings → Appearance). **Never
  hardcode accent hexes in screens** — everything goes through the palette.
  The two deliberate exceptions (semantic bad→great scales, not chrome):
  `ranking/score.ts` gradient anchors and `wrapped.tsx` `BAR_TINTS`.
  **Typography:** `DisplayFont` (Fraunces, loaded in the root layout) is the
  editorial serif for the wordmark, tab headers, and `ThemedText`
  title/subtitle; body text stays system sans. Don't pair `fontWeight` with
  the custom family (Android falls back to system).
  **Doodles:** `components/doodles.tsx` — hand-drawn SVG empty-state art
  (vinyl/mic/cassette, react-native-svg), one accent detail each, passed to
  `EmptyState` via the `doodle` prop.

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

## Supabase
With the env vars set, the whole app runs on hosted Supabase: auth, ratings,
social graph + feed, concerts, comments, and likes. Without them, everything
except comments/likes degrades to local backends (those two are
Supabase-only by design).

- **Setup**: copy `.env.example` to `.env` and fill in
  `EXPO_PUBLIC_SUPABASE_URL` / `EXPO_PUBLIC_SUPABASE_ANON_KEY` from a Supabase
  project (Project Settings → API). The same `.env` also holds the Spotify
  keys that power search — see the Stack section. `src/lib/supabase.ts` is
  lazily initialized, so a missing config only breaks features on first use.
- **Schema**: run `supabase/setup.sql` on a fresh project (it concatenates
  `migrations/0001`–`0008`, ending in the hardened policies), or apply the
  numbered migrations in order. `reset.sql` drops and recreates everything —
  never run it on a DB with real data.
- **RLS posture** (0007 + 0008): reads are public (guests browse ratings,
  profiles, comments); writes and deletes are scoped to the owner via
  `auth.uid()`. The `items` catalog cache is insert-only — clients upsert with
  `ignoreDuplicates` so no one can rewrite shared metadata. Requires Supabase
  Auth to be the active backend (it is whenever the env is configured).
- Rows written before the auth migration under LocalAuthBackend ids are
  orphaned (unowned but readable); clean up via SQL Editor if they bother you.

## Web marketing + ads
The web deploy (myjelli.site, Vercel static expo export — `vercel.json` uses
`cleanUrls` so the per-route SSG HTML is actually served to crawlers instead
of the SPA fallback) carries an ad-monetization seam:
- `src/app/about.tsx` + `src/app/privacy.tsx` — public, crawlable content
  pages (ad networks reject bare app shells). Linked from Settings → ABOUT
  and listed in `public/sitemap.xml` / `robots.txt`. Keep the privacy page's
  Advertising section in sync with any ad wiring changes.
- `src/app/+html.tsx` — site-wide SEO/OG/Twitter meta (share image
  `public/og.png`, 1200×630 in the vinyl palette) and the AdSense loader,
  injected only when `EXPO_PUBLIC_ADSENSE_CLIENT` is set.
- `src/components/ad-slot.tsx` — a display-ad unit that renders nothing
  unless web + client id + a per-placement slot id are all set (one placement
  ships: `EXPO_PUBLIC_ADSENSE_SLOT_FEED`, bottom of the Feed tab). Keep ads
  out of the Rate flow and Ranks — core interactions stay clean.
- `public/ads.txt` is a commented placeholder until AdSense approval; fill in
  the real `google.com, pub-…` line then. Native ads would be AdMob — a
  separate integration, deliberately not wired.
