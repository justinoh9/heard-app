# Heard — Session Handoff

Working context for continuing development in a new session. For the product
vision and rationale see `SPEC.md`; for repo conventions see `CLAUDE.md`.

## What Heard is
A social music-rating app — "Letterboxd for music." Rate songs and albums 0–10,
break ties with side-by-side comparisons, build a ranked profile, comment
publicly on a song/album's page, see friends' activity, and climb a
leaderboard. Expo (SDK 56) + expo-router + React Native 0.85 + TypeScript
(strict). Auth and ratings are still mock/in-memory/on-device; **comments are
the one feature backed by a real hosted database (Supabase)** — see below.

## Status: what's built (Phases 1–5 + leaderboard + song profiles/comments)
- **Auth** — email/password sign-up + sign-in, session persisted on-device, route
  gating (signed-out users can't reach the app). "Continue with Spotify" is a stub.
- **Music search** — live debounced MusicBrainz search, both album (release-group)
  and song/track (recording) results, with cover art (Cover Art Archive) and
  already-rated score pills. `rate.tsx`'s search tab stays album-only; track
  search is wired into the catalog seam (`MusicCatalog.searchTracks`/`searchAll`)
  for the item-profile flow and future surfaces.
- **Rate flow** — a modal: pick a 0–10 score (stepper, **0.1** fine increment),
  tie-break comparisons fire only when the score collides with existing items,
  then an optional, skippable review-text step that posts a public comment.
- **Item profile page** (`/item/[id]`) — public song/album page: cover, rating
  status, a standalone comment box, and the public comment list (Supabase-backed,
  readable by anyone). Reached by tapping a feed card.
- **Profile** — favorites cover strip + full ranked list (tap to re-rate),
  stats, concert badges. Shows the live signed-in user.
- **Feed** — image-forward cards (covers, scores, reviews), daily-drop, streaks;
  cards with an attached item now link to that item's profile page.
- **Leaderboard** — "Ranks" tab. Sort accounts by a metric (Reviews/Concerts/Streak)
  within a scope (Global/Friends). Current user injected live + highlighted; medals
  for top 3. Extensible: add a metric = one entry in `METRICS`.
- **Polish** — haptics, step-transition fades, and a winner-highlight animation
  in the rate/compare flow; shared `EmptyState`/`Skeleton` components.

Everything above is verified working in the browser (web build), **except** the
Supabase-backed comments network calls — those need a real Supabase project +
`.env` populated locally (see "Comments & Supabase" below); not yet exercised
end-to-end in this environment.

## Architecture — the swappable "seams"
Screens talk only to these interfaces, so real backends drop in later without UI
changes. This is the core design principle — keep it.

| Concern | Interface / hook | Ships now | Drops in later |
|---|---|---|---|
| Auth | `useAuth()` / `AuthBackend` | `LocalAuthBackend` (AsyncStorage + expo-crypto) | `SupabaseAuthBackend` |
| Ratings | `useRatings()` / `RankingEngine` | `RatingTiebreakEngine` (in-memory store) | Supabase store / Elo engine |
| Music search | `MusicCatalog` | `MusicBrainzCatalog` (albums + tracks) | `SpotifyCatalog` |
| Comments | `useComments()` / `CommentsBackend` | `SupabaseCommentsBackend` (real DB, scoped to this seam only) | — already real; revisit only the auth-trust gap (below) |
| Leaderboard | mock `LEADERBOARD_USERS` + `METRICS` | mock data | Supabase aggregates |

**Rating engine rule:** the 0–10 score does the coarse sort; comparisons only
break ties within the same score. Every comparison is logged (`comparisonLog`)
even though the current engine ignores it — that banks data for a future Elo engine.

## Comments & Supabase
Comments are intentionally the *only* part of the app backed by a real
database right now — auth and ratings deliberately were not migrated in the
same pass, to keep this change scoped.

- **One-time setup** (not yet done in this environment): create a free
  Supabase project, run `supabase/migrations/0001_comments.sql` in its SQL
  Editor, then copy `.env.example` → `.env` and fill in
  `EXPO_PUBLIC_SUPABASE_URL` / `EXPO_PUBLIC_SUPABASE_ANON_KEY` from
  Project Settings → API (anon **public** key only, never `service_role`).
  Without this, `src/lib/supabase.ts` throws at module load — everything
  else in the app still works, only comments break.
- **Known, documented trust gap**: identity is still `LocalAuthBackend`, not
  Supabase Auth, so Postgres RLS can't cryptographically verify who's posting.
  The `comments` table allows public read and trusts the client-supplied
  `user_id`/`display_name` on insert (same trust level as the rest of this
  prototype). Don't "fix" this by adding fake auth checks — revisit for real
  once/if auth migrates to Supabase Auth (`auth.uid()` becomes available).

## Key files
- `src/app/_layout.tsx` — root: providers + `Stack` + auth-gate redirect + `log` modal.
- `src/app/(auth)/` — `sign-in.tsx`, `sign-up.tsx`, `_layout.tsx`.
- `src/app/(tabs)/_layout.tsx` — 4 tabs: `index` (Feed), `rate` (Rate), `leaderboard` (Ranks), `profile`.
- `src/app/(tabs)/{index,rate,leaderboard,profile}.tsx` — the tab screens.
- `src/app/log.tsx` — rate/tie-break/review modal (`presentation: 'modal'`); reads
  the item (incl. `type`/`artUrl`) via route params, posts an optional review
  via `postComment` from `src/comments`.
- `src/app/item/[id].tsx` — public song/album profile page: header, rate/update
  button, standalone comment box, comment list via `useComments`.
- `src/auth/` — `types.ts`, `local-backend.ts`, `store.tsx` (`AuthProvider`/`useAuth`), `ui.tsx`.
- `src/ranking/` — `types.ts` (`Item`, `ItemType`), `engine.ts` (`RankingEngine`, `RatingTiebreakEngine`, `sortRanked`, `Placement`), `engine.test.ts`.
- `src/data/` — `catalog.ts` (seed albums/feed/profile, real MusicBrainz MBIDs;
  `FeedEvent` now carries `itemId`/`itemType` so cards can link out), `store.ts`
  (`RatingsContext`/`useRatings`/`useRatingsState`).
- `src/music/` — `types.ts` (`SearchResult` with a `kind: 'album'|'song'`
  discriminant), `musicbrainz.ts` (`parseAlbumResults`, `parseTrackResults`,
  `searchAlbums`/`searchTracks`/`searchAll`), `provider.ts` (`musicCatalog`
  singleton), `useMusicSearch.ts` (debounced, takes a `kind` param), `index.ts`
  (barrel), `musicbrainz.test.ts`.
- `src/comments/` — `types.ts` (`Comment`, `CommentsBackend`),
  `supabase-backend.ts` (`SupabaseCommentsBackend`), `store.ts`
  (`useComments` hook + standalone `postComment`), `index.ts` (barrel).
- `src/lib/supabase.ts` — Supabase client singleton (throws if env vars missing).
- `supabase/migrations/0001_comments.sql` — the `comments` table + RLS policies.
- `src/leaderboard/data.ts` — `LEADERBOARD_USERS`, `METRICS`, types.
- `src/components/` — `album-cover.tsx` (expo-image + `Skeleton` while loading),
  `comment-card.tsx`, `empty-state.tsx`, `skeleton.tsx`, `text-field.tsx`,
  `themed-text.tsx`, `themed-view.tsx`.
- `src/hooks/use-haptics.ts` — `expo-haptics` wrapper, no-op on web.
- `src/constants/theme.ts` — `Colors`, `Spacing`, `Fonts`. Accent green is `#1D9E75`.

## Conventions
- Theming via `ThemedText` / `ThemedView` / `useTheme()` / `Colors` / `Spacing`. Sentence case.
- Interactive controls carry `testID`s for browser testing: `auth-submit`,
  `album-result`, `step-<n>`, `rate-confirm`, `compare-new` / `compare-existing`,
  `done`, `scope-<global|friends>`, `metric-<reviews|concerts|streak>`.
- Album art everywhere via `AlbumCover` (handles missing/broken covers).
- `.env` (gitignored) is required for the comments feature — see "Comments &
  Supabase" above. `.env.example` documents the two required keys.

## Run & verify (Windows)
- `npm run web` — easiest local check; opens in browser. Use Chrome device toolbar
  (`Ctrl+Shift+M`) → iPhone for the mobile view.
- `npm start` — Expo dev server (Expo Go on a phone).
- `npm test` — ranking + music unit tests (tsx + node:test, currently 20 passing).
- `npx tsc --noEmit` — typecheck (should be clean).
- Browser auto-verify uses the preview MCP (`.claude/launch.json` → server "web" on
  port 8088). Test login that persists in localStorage on :8088 is
  `justin@heard.app` / `hunter2pass` (accounts are per-browser-origin) — though
  in a fresh browser/session this account may not exist yet; sign up instead.

## Gotchas already solved (don't re-hit these)
- **Browser `fetch` must be bound to `globalThis`** — calling it as an instance
  property throws "Illegal invocation" on web (works on native). Done in `MusicBrainzCatalog`.
- **Typed routes** (`experiments.typedRoutes`) generate `.expo/types`. After
  adding/moving routes, Metro can show a stale "Unable to resolve module" or wrong
  href types — fix with a cache-clear restart (`expo start --clear`). Redirect to
  `'/'`, not `'/(tabs)'`. This applies to the new `src/app/item/[id].tsx` route too.
- **`.claude/` and `expo-env.d.ts` are gitignored** (local config). Don't commit them.
- **LF→CRLF git warnings** on Windows are harmless.
- **MusicBrainz** is rate-limited (~1 req/sec, hence the 350ms search debounce) and
  has **no popularity data** — see deferral below. Recording (track) search is
  noisier than release-group search — duplicate masters/regional releases/live
  versions with no way to pick a canonical one.
- **Supabase on RN/Hermes needs `react-native-url-polyfill`** — Hermes doesn't
  fully implement the `URL` global that `@supabase/supabase-js`'s dependency
  chain needs. Already wired in `src/lib/supabase.ts` (`import 'react-native-url-polyfill/auto'`
  at the top) — don't remove it.

## Branch / git state
- `main` (on GitHub `justinoh9/heard-app`) = Phases 1–5 (`4185a06`).
- Current branch **`feature/leaderboard`** = leaderboard + 0.1 increment +
  search-deferral note (`080a936`), core-loop polish (`099b043`, PR #1 open
  against `main`), plus this session's song-profile/comments work (uncommitted
  as of writing — see `git status`).
- `feature/user-accounts` and `feature/music-search` are local-only and fully
  contained in `main` (safe to delete).

## Next / pending
1. **Finish verifying song profiles/comments end-to-end** — needs a real
   Supabase project created and `.env` populated (see "Comments & Supabase").
   Not yet done in this environment.
2. **Settings page skeleton**: a settings screen for the user + their
   preferences. Suggested approach — a route reachable from Profile (e.g.
   `src/app/settings.tsx` pushed from a gear icon in the profile header, or a
   `(tabs)` entry). Skeleton sections to stub: Account (display name, email, change
   password, sign out), Preferences (theme/appearance, default rating increment,
   feed/notification toggles), Privacy (profile visibility, friends), About.
3. **Merge PR #1** (core-loop polish) when ready.
4. **Supabase backend for auth + ratings** — persist accounts + ratings, real
   users/friends for the leaderboard. Swap `LocalAuthBackend` and the
   in-memory store. Comments already prove the Supabase wiring works; this
   would also close the comments RLS trust gap (`auth.uid()` becomes available).
5. **Spotify catalog** — implement `SpotifyCatalog` behind `MusicCatalog`. This is
   what fixes the deferred search gaps (artist-name prioritization +
   popularity-first ranking, for both albums and the new track search).
   MusicBrainz can't: it has no popularity signal and artist searches surface
   unrelated same-title releases (verified via the API). Needs a backend to
   hold the OAuth secret.
