# Jelli

**A social music-rating app — Letterboxd for albums.** Live at
**[myjelli.site](https://myjelli.site)**; the same codebase builds for iOS and
Android.

Rating an album 1–10 cold is hard, and the numbers drift until your own list stops
meaning anything. So Jelli never asks for a score in isolation: you give a rough
rating, then the app shows you something you already rated similarly and asks
which you prefer. A few comparisons place the album precisely inside your ranking.
The score does the coarse sort; the head-to-heads break ties.

📄 **[Read the case study →](CASE_STUDY.md)** — the problem, the architecture, and
a security bug that every test I had said didn't exist.

---

## Stack

| | |
|---|---|
| **Client** | Expo SDK 56, React Native 0.85, React 19, TypeScript (strict), expo-router |
| **Backend** | Supabase — Postgres + row-level security, PostgREST, Auth, Storage |
| **Music data** | iTunes Search API (catalog), Last.fm (popularity), Deezer (artist art), Photon (venue geocoding) |
| **Testing** | `node:test` via `tsx`; a Docker harness that replays every migration into a throwaway Postgres |
| **Deploy** | Vercel (static Expo web export) |

There is no custom server. Rules that must not be client-enforced live in SQL as
RLS policies, `SECURITY DEFINER` functions, and rate-limit triggers.

## Running it

```bash
npm install
npm run web          # browser (easiest local check)
npm start            # Expo dev server — scan the QR with Expo Go for a phone
```

It runs with **no configuration**: without Supabase credentials every feature
falls back to on-device storage. To run against a real backend, copy
`.env.example` to `.env`, fill in `EXPO_PUBLIC_SUPABASE_URL` and
`EXPO_PUBLIC_SUPABASE_ANON_KEY`, and apply `supabase/migrations/` in order.

## Commands

```bash
npm test                 # 430 unit tests (pure logic — no network, no React)
npx tsc --noEmit         # typecheck
npm run test:migrations  # replay all 32 migrations into a throwaway Postgres (needs Docker)
npm run check:live       # ask the LIVE project which migrations actually landed
```

The last two answer different questions, and the difference caused a real
incident: `test:migrations` proves the SQL is **correct**, `check:live` proves
production actually **has** it. See [CASE_STUDY.md](CASE_STUDY.md).

## Architecture in one diagram

```
Screens  ──►  Stores (React context)  ──►  Backend seam (interface)
                                              ├── Supabase impl  ──► PostgREST ──► Postgres + RLS
                                              └── AsyncStorage impl (offline / zero-config)
```

Screens never import Supabase. Pure logic (ranking math, feed folding, streak
transitions, search parsing) lives in its own files with no React and no network,
which is why the whole suite runs in about three seconds.

## Docs

| File | What's in it |
|---|---|
| [CASE_STUDY.md](CASE_STUDY.md) | Problem, audience, architecture, hardest bug, what I'd improve |
| [CLAUDE.md](CLAUDE.md) | Engineering notes — conventions, and the scar tissue behind them |
| [SPEC.md](SPEC.md) | Product spec and rationale |
| [PRODUCT_BLUEPRINT.md](PRODUCT_BLUEPRINT.md) | Mechanics and data models |
| [ROADMAP.md](ROADMAP.md) | Sequenced plan and what's shipped |
