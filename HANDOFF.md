# Heard — Session Handoff

Working context for continuing development in a new session. For the product
vision and rationale see `SPEC.md`; for repo conventions see `CLAUDE.md`.

## What Heard is
A social music-rating app — "Letterboxd for music." Rate albums 0–10, break ties
with side-by-side comparisons, build a ranked profile, see friends' activity, and
climb a leaderboard. Expo (SDK 56) + expo-router + React Native 0.85 + TypeScript
(strict). No backend yet — all data is mock/in-memory/on-device.

## Status: what's built (Phases 1–5 + leaderboard)
- **Auth** — email/password sign-up + sign-in, session persisted on-device, route
  gating (signed-out users can't reach the app). "Continue with Spotify" is a stub.
- **Album search** — live debounced MusicBrainz search with cover art (Cover Art
  Archive), album-first results, already-rated score pills.
- **Rate flow** — a modal: pick a 0–10 score (stepper, **0.1** fine increment),
  then tie-break comparisons fire only when the score collides with existing albums.
- **Profile** — favorites cover strip + full ranked list (tap to re-rate),
  stats, concert badges. Shows the live signed-in user.
- **Feed** — image-forward cards (covers, scores, reviews), daily-drop, streaks.
- **Leaderboard** — "Ranks" tab. Sort accounts by a metric (Reviews/Concerts/Streak)
  within a scope (Global/Friends). Current user injected live + highlighted; medals
  for top 3. Extensible: add a metric = one entry in `METRICS`.

Everything above is verified working in the browser (web build).

## Architecture — the swappable "seams"
Screens talk only to these interfaces, so real backends drop in later without UI
changes. This is the core design principle — keep it.

| Concern | Interface / hook | Ships now | Drops in later |
|---|---|---|---|
| Auth | `useAuth()` / `AuthBackend` | `LocalAuthBackend` (AsyncStorage + expo-crypto) | `SupabaseAuthBackend` |
| Ratings | `useRatings()` / `RankingEngine` | `RatingTiebreakEngine` (in-memory store) | Supabase store / Elo engine |
| Music search | `MusicCatalog` | `MusicBrainzCatalog` | `SpotifyCatalog` |
| Leaderboard | mock `LEADERBOARD_USERS` + `METRICS` | mock data | Supabase aggregates |

**Rating engine rule:** the 0–10 score does the coarse sort; comparisons only
break ties within the same score. Every comparison is logged (`comparisonLog`)
even though the current engine ignores it — that banks data for a future Elo engine.

## Key files
- `src/app/_layout.tsx` — root: providers + `Stack` + auth-gate redirect + `log` modal.
- `src/app/(auth)/` — `sign-in.tsx`, `sign-up.tsx`, `_layout.tsx`.
- `src/app/(tabs)/_layout.tsx` — 4 tabs: `index` (Feed), `rate` (Rate), `leaderboard` (Ranks), `profile`.
- `src/app/(tabs)/{index,rate,leaderboard,profile}.tsx` — the tab screens.
- `src/app/log.tsx` — rate/tie-break modal (`presentation: 'modal'`); reads album via route params.
- `src/auth/` — `types.ts`, `local-backend.ts`, `store.tsx` (`AuthProvider`/`useAuth`), `ui.tsx`.
- `src/ranking/` — `types.ts`, `engine.ts` (`RankingEngine`, `RatingTiebreakEngine`, `sortRanked`, `Placement`), `engine.test.ts`.
- `src/data/` — `catalog.ts` (seed albums/feed/profile, real MusicBrainz MBIDs), `store.ts` (`RatingsContext`/`useRatings`/`useRatingsState`).
- `src/music/` — `types.ts`, `musicbrainz.ts`, `provider.ts` (`musicCatalog` singleton), `useAlbumSearch.ts` (debounced), `index.ts` (barrel), `musicbrainz.test.ts`.
- `src/leaderboard/data.ts` — `LEADERBOARD_USERS`, `METRICS`, types.
- `src/components/` — `album-cover.tsx` (expo-image + fallback), `text-field.tsx`, `themed-text.tsx`, `themed-view.tsx`.
- `src/constants/theme.ts` — `Colors`, `Spacing`, `Fonts`. Accent green is `#1D9E75`.

## Conventions
- Theming via `ThemedText` / `ThemedView` / `useTheme()` / `Colors` / `Spacing`. Sentence case.
- Interactive controls carry `testID`s for browser testing: `auth-submit`,
  `album-result`, `step-<n>`, `rate-confirm`, `compare-new` / `compare-existing`,
  `done`, `scope-<global|friends>`, `metric-<reviews|concerts|streak>`.
- Album art everywhere via `AlbumCover` (handles missing/broken covers).

## Run & verify (Windows)
- `npm run web` — easiest local check; opens in browser. Use Chrome device toolbar
  (`Ctrl+Shift+M`) → iPhone for the mobile view.
- `npm start` — Expo dev server (Expo Go on a phone).
- `npm test` — ranking + music unit tests (tsx + node:test, currently 15 passing).
- `npx tsc --noEmit` — typecheck (should be clean).
- Browser auto-verify uses the preview MCP (`.claude/launch.json` → server "web" on
  port 8088). Test login that persists in localStorage on :8088 is
  `justin@heard.app` / `hunter2pass` (accounts are per-browser-origin).

## Gotchas already solved (don't re-hit these)
- **Browser `fetch` must be bound to `globalThis`** — calling it as an instance
  property throws "Illegal invocation" on web (works on native). Done in `MusicBrainzCatalog`.
- **Typed routes** (`experiments.typedRoutes`) generate `.expo/types`. After
  adding/moving routes, Metro can show a stale "Unable to resolve module" or wrong
  href types — fix with a cache-clear restart (`expo start --clear`). Redirect to
  `'/'`, not `'/(tabs)'`.
- **`.claude/` and `expo-env.d.ts` are gitignored** (local config). Don't commit them.
- **LF→CRLF git warnings** on Windows are harmless.
- **MusicBrainz** is rate-limited (~1 req/sec, hence the 350ms search debounce) and
  has **no popularity data** — see deferral below.

## Branch / git state
- `main` (on GitHub `justinoh9/heard-app`) = Phases 1–5 (`4185a06`).
- Current branch **`feature/leaderboard`** (`080a936`) = leaderboard + 0.1 increment
  + search-deferral note. **One commit ahead of `main`, NOT pushed yet.**
- `feature/user-accounts` and `feature/music-search` are local-only and fully
  contained in `main` (safe to delete).
- To ship the leaderboard work: fast-forward `main` to `feature/leaderboard` and push.

## Next / pending
1. **Settings page skeleton** (the immediate ask): a settings screen for the user +
   their preferences. Suggested approach — a route reachable from Profile (e.g.
   `src/app/settings.tsx` pushed from a gear icon in the profile header, or a
   `(tabs)` entry). Skeleton sections to stub: Account (display name, email, change
   password, sign out), Preferences (theme/appearance, default rating increment,
   feed/notification toggles), Privacy (profile visibility, friends), About. Wire
   real persistence later via the auth/Supabase seam.
2. **Push `feature/leaderboard` → `main`** when ready.
3. **Supabase backend** — persist accounts + ratings, real users/friends for the
   leaderboard. Swap `LocalAuthBackend` and the in-memory store; needs a Supabase
   project URL + anon key.
4. **Spotify catalog** — implement `SpotifyCatalog` behind `MusicCatalog`. This is
   what fixes the two deferred search gaps (artist-name prioritization +
   popularity-first ranking). MusicBrainz can't: it has no popularity signal and
   artist searches surface unrelated same-title releases (verified via the API).
   Needs a backend to hold the OAuth secret.
