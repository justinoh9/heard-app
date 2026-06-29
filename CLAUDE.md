# Heard

A social music-rating app. See `SPEC.md` for the full product spec and rationale.

## Stack
- Expo (SDK 56) + expo-router (file-based routing, `src/app/`)
- React Native 0.85, TypeScript (strict)
- Icons: `@expo/vector-icons` (Ionicons)
- No backend yet — mock data in `src/data/`. Spotify + Supabase are the planned
  integrations (SPEC §7).

## Layout
- `src/app/` — routes. Three tabs: `index.tsx` (Feed), `rate.tsx` (Rate), `profile.tsx`.
  `_layout.tsx` defines the tabs and wraps everything in the ratings provider.
- `src/ranking/` — the core rating engine.
  - `types.ts` — `Item`, `RankedItem`, `Comparison`, `ComparisonEvent`.
  - `engine.ts` — `RankingEngine` interface (swappable) + `RatingTiebreakEngine`
    (ships now). Score does the coarse sort; comparisons binary-insert within a tie
    group. See SPEC §5.
  - `engine.test.ts` — unit tests for the tie-break logic.
- `src/data/` — `catalog.ts` (mock songs/feed/profile) and `store.ts` (in-memory
  ratings store + `useRatings()` hook). This is the seam the backend replaces.
- `src/components/`, `src/constants/theme.ts`, `src/hooks/` — template UI primitives
  (`ThemedText`, `ThemedView`, `useTheme`, `Colors`, `Spacing`).

## Commands
- `npm run web` — run in browser (easiest local check on Windows)
- `npm start` — Expo dev server (scan QR with Expo Go for a phone)
- `npm test` — run ranking engine tests (tsx + node:test)
- `npx tsc --noEmit` — typecheck

## Conventions
- Keep screens talking only to `useRatings()` and the `RankingEngine` interface —
  never reach past them into engine internals, so the engine stays swappable.
- Every head-to-head is logged to `comparisonLog` even though the current engine
  only needs final order — that banked data enables a future Elo engine (SPEC §5).
