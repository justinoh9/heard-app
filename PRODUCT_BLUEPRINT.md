# Heard — Product Blueprint

> **Audience:** an AI developer model (Claude Fable 5) executing the build.
> **Purpose:** turn the existing MVP ("Letterboxd for Music" × "Beli for Music")
> into a sticky, feature-rich social product.
> **Companion docs:** `SPEC.md` (product rationale), `CLAUDE.md` (stack + layout).
>
> **Read this first — what already exists.** Do not rebuild these; extend them.
> - **Comparative ranking engine** — `src/ranking/engine.ts` (`RankingEngine`
>   interface + `RatingTiebreakEngine`). This *is* the Beli mechanic. Score does
>   the coarse sort; head-to-heads binary-insert within a tie group. Every
>   comparison is banked to `comparisonLog` (`{winnerId, loserId, timestamp}`)
>   for a future Elo engine.
> - **Music catalog seam** — `src/music/` (`MusicCatalog` interface +
>   `SpotifyCatalog`). Search, artist pages, album tracklists, popularity — live
>   on Spotify Web API (Client Credentials).
> - **Ratings store** — `src/data/store.ts` (`useRatings()`), currently in-memory.
> - **Social data** — `src/comments/`, `src/likes/` are Supabase-backed today.
> - **Streaks** — `src/streaks/`, `AsyncStorage`-persisted.
> - **Auth** — `src/auth/` (`LocalAuthBackend`), local/in-memory.
>
> **Guiding principle:** every screen talks only to a seam (`useRatings()`,
> `MusicCatalog`, `CommentsBackend`…), never to internals. New features follow
> the same pattern so providers stay swappable.

---

## 1. Core Mechanics Breakdown

The goal is to import the *growth loops* — not the surface features — of
Letterboxd and Beli, and re-target them at music's three logged entities:
**tracks, albums, and live concerts**.

### 1.1 Letterboxd's loops → music

| Letterboxd loop | Why it's sticky | Music translation |
|---|---|---|
| **Diary logging** (dated, re-watchable) | Low-friction habit; a personal timeline you accrue | **Listen diary** — a dated log entry per active listen. Songs/albums are *re-loggable* (you can log the same album on many dates, like a rewatch). Feeds the streak + Wrapped. |
| **4 Favorites** | Identity in one glance; the most-screenshotted UI in the app | **Top 4** — four defining albums pinned to the profile header (see §2.4 & Key Features). |
| **Custom lists** | User-generated, shareable, SEO/virality engine | **Lists** — ordered, titled, cover-collaged collections ("Best Rap of 2020", "Rainy Day"), rankable and shareable. |
| **Rich reviews** | Long-form writing → repeat visits, comments | **Reviews** — markdown-lite text attached to a rating, with likes + threaded comments (comments/likes infra already exists). |
| **Star rating** | Fast, universal | Kept as the *entry* to the rating engine, but replaced downstream by comparative sort (see §1.2). |

### 1.2 Beli's loops → music

| Beli loop | Why it's sticky | Music translation |
|---|---|---|
| **Comparative A/B ranking** | Removes rating anxiety; produces a *true* ordered list without manual sorting | **Already built** (`RatingTiebreakEngine`). User gives 0–10; ties trigger "Did you prefer A or B?" head-to-heads. Extend the *trigger surface* and *recommendation* on top of it (§2.2). |
| **Taste profile** | The payoff — "here's who you are" | **Taste profile** — top genres, decades, artists, mean score, most-logged; drives compatibility (§1.3). |
| **Friend leaderboards** | Competitive, social proof, daily check-in reason | **Leaderboards** — already a tab; extend with friend-scoped ranks + weekly reset for recency. |
| **Reservation/place tracking (map)** | Real-world layer, aspirational list ("want to go") | **Concert logging** — venues, dates, setlist, tagged friends, a *wishlist* of upcoming shows (§2.3 & Key Features). |
| **Recs from taste-similar users** | Discovery that feels personal | **Compatibility-weighted feed + recs** (§1.3, §2.3). |

### 1.3 The compounding loop (how it all locks together)

```
Active log ──► Rating (0–10) ──► Comparative tie-break ──► Ordered taste list
    │                                                            │
    ▼                                                            ▼
 Streak +Wrapped                                          Taste profile
    │                                                            │
    └──────────────► Feed event ──► Friends react/compare ──► Compatibility %
                          │                                      │
                          └──────────► Follow more people ◄──────┘
```

The single most important sentence for the developer: **every meaningful action
must emit a `feed_event` and, where relevant, call `recordActivity()`** (the
streak hook). That is what converts a private tracker into a social loop.

---

## 2. Polished Feature Set (Prioritized for Implementation)

Priority key: **P0** = do first (core loop polish), **P1** = fast-follow,
**P2** = depth/retention.

### 2.A Data & Frictionless Onboarding

**Design tension to respect:** we want Spotify's *data* for zero-friction
onboarding, but we are an **active** logger, not a passive scrobbler (§2.B tie-in).
The import surfaces *candidates*; the user still presses **Log**.

- **[P0] Spotify OAuth (user scope).** Current `SpotifyCatalog` uses Client
  Credentials (app-level, read-only catalog). Add a **user-authorized** flow
  (Authorization Code + PKCE via `expo-auth-session`) to unlock per-user data.
  - Scopes: `user-top-read`, `user-read-recently-played`, `user-library-read`,
    `playlist-read-private`.
  - **New seam:** `src/music/user-library.ts` → `UserLibrary` interface
    (`getTopTracks`, `getTopArtists`, `getRecentlyPlayed`, `getSavedAlbums`),
    with `SpotifyUserLibrary` impl. Keep it *separate* from the catalog seam so
    unauthenticated catalog search still works.
- **[P0] "Recently played" import tray on the Rate tab.** A horizontally
  scrollable strip of the user's last ~30 plays, each a one-tap entry into the
  log flow. This is the frictionless on-ramp.
- **[P1] First-run onboarding wizard.** After OAuth: (1) pull top 20 tracks,
  (2) let the user rapid-rate ~10 to seed the ranking engine and taste profile,
  (3) suggest 3–5 people to follow (by artist overlap). A cold-start-solving
  wizard massively lifts D1 retention.
- **[P1] Metadata enrichment.** Album art, tracklist, release year, genres
  (Spotify artist genres), duration — cache into the `items` table on first
  reference. `getAlbumTracks` already exists; extend caching.
- **[P2] Apple Music (MusicKit).** Behind the same `MusicCatalog`/`UserLibrary`
  seams. Backlog per SPEC §2.

**Explicitly NOT doing:** background scrobbling / auto-logging. Import is a
convenience shortcut, never an automatic diary entry.

### 2.B The Rating Engine

The engine exists. This section is about **when and how it surfaces**, and the
*active-log* guarantee.

- **[P0] Active-log flow (the intentionality guarantee).** Logging is a
  deliberate act: `Log` button → pick rating (0–10) → optional review → confirm.
  A play in the import tray is *not* a diary entry until logged. Keep the
  existing `log.tsx` modal as the single funnel.
- **[P0] Rating input = 0–10, half-step.** Matches SPEC §4. The number is the
  headline and does the coarse sort. Resolve open question in SPEC §9 as:
  **half-steps (8.5)**, free-decimal disabled (avoids clustering + fake precision).
- **[P0] Comparative tie-break (existing).** On commit, if the score ties
  others, drive `Placement.next()`/`.choose()` loop in the log modal. Escape
  hatches required: **"Too close to call"** (splits the tiebreak evenly / stops
  the loop) and **"Haven't heard it"** (skips that opponent). Wire both into
  `Placement`.
- **[P1] "Re-rank" prompt (the Beli nudge).** Occasionally (e.g. after logging,
  1-in-N, or on the profile), prompt: *"Did you like this more or less than
  [an album you rated near it]?"* This uses the **same** `Placement` machinery
  against a *non-tied* neighbor to sharpen the global order over time and bank
  more comparison events. This is the headline "Comparative Ranking" Key Feature.
- **[P1] Per-type lists.** Songs, albums, artists, and concerts each get their
  own ranked list (engine is type-agnostic; `Item.type` already exists). The
  profile shows tabs across them.
- **[P2] Elo engine.** Drop-in `EloEngine implements RankingEngine`, replay
  `comparisons` table. No user-facing re-asking (that's the whole point of
  banking the log). Ship behind a flag; compare against tie-break order.

### 2.C Social & Community

This is the daily-active-use engine. **Requires the auth migration** (see §3.4)
to be trustworthy, but can be built against `LocalAuthBackend` first.

- **[P0] Follow graph + activity feed.** `follows` table; feed = reverse-chron
  `feed_events` from followees. Feed card types: `rated`, `reviewed`,
  `logged_concert`, `made_list`, `hit_streak`, `daily_drop`. Every card has
  hearts + comments (infra exists).
- **[P0] Taste Compatibility Score.** On a profile, show a **% match** vs the
  viewer. Algorithm (deterministic, cheap, explainable):
  - Overlap set = items both users rated.
  - `score_sim = 1 − mean(|a.score − b.score|)/10` over the overlap.
  - `coverage = min(1, overlap_count / 15)` (dampens tiny-overlap noise).
  - `artist_sim = Jaccard(topArtistsA, topArtistsB)`.
  - **`compat = round(100 × (0.6·score_sim·coverage + 0.4·artist_sim))`**.
  - Show the **3 shared favorites** driving it ("You both love *Blond*").
- **[P1] Daily Drop (audio-BeReal).** Once/day, time-boxed prompt to share the
  one thing you're listening to now. Top-of-feed card. Creates a daily open reason.
- **[P1] Concert friend-tagging.** Tag attendees when logging a show; the show
  appears on all tagged profiles (with confirm). Real-world social layer.
- **[P2] Shared/blend lists & group leaderboards.** Collaborative lists;
  friend-scoped weekly leaderboard with reset.
- **[P2] Notifications.** New follower, comment, tag, friend beat your streak,
  a taste-twin rated something you haven't heard.

### 2.D User Profiles & Gamification

- **[P0] Profile header = identity.** Top 4 showcase (Key Feature), then stat
  row (rated count / concerts / streak), then ranked lists (tabbed by type).
  This is the screenshot surface — make it beautiful (§4).
- **[P0] Streaks (existing).** Keep `src/streaks/`. Surface a streak stat that
  pushes to `streak.tsx`. Ensure *every* log path calls `recordActivity()`.
- **[P1] Year-round "Wrapped".** Not once-a-year — a *live* stats dashboard:
  minutes-equivalent, top genres/decades, most-logged artist, rating
  distribution, "your month in music". Recomputed from the diary; shareable card
  export (see §4 share cards).
- **[P1] Profile customization.** Accent color, header collage from Top 4 art,
  bio, pinned list.
- **[P2] Badges/achievements.** Concert milestones ("10 shows"), genre-explorer,
  streak tiers, "first to rate" an album. Ties into concert collecting (a stated
  differentiator).

---

## 3. Data Models & Architecture Prep

Backend is **Supabase (Postgres)**. Extends SPEC §6. `comments`/`likes` tables
already exist (`supabase/migrations/0001`, `0002`). Add the migrations below.

### 3.1 Entity relationship overview

```
users ─1:N─ ratings ─N:1─ items          items self-ref: album 1:N tracks
  │  │        │                                  (parent_item_id)
  │  │        └─N:1─ reviews (1:1 optional per rating)
  │  ├─1:N─ comparisons  (banked head-to-heads)
  │  ├─1:N─ concerts ─N:M─ users (attendees via concert_tags)
  │  ├─1:N─ lists ─1:N─ list_items ─N:1─ items
  │  ├─1:N─ feed_events
  │  └─M:N─ users (follows)
  └─1:1─ taste_profiles (materialized, recomputed on write)
```

### 3.2 Core tables (SQL-shaped; write as `0003_core.sql`, `0004_social.sql`, …)

```sql
-- items: cached catalog entities (songs/albums/artists), keyed by Spotify id.
items (
  id            text primary key,         -- spotify id
  type          text not null,            -- 'song' | 'album' | 'artist'
  title         text not null,
  artist        text not null,
  art_url       text,
  release_year  int,
  genres        text[],                   -- from Spotify artist genres
  parent_item_id text references items(id),-- track -> album
  spotify_uri   text,
  popularity    int
)

-- ratings: a user's rating of one item. Headline score + hidden tiebreak.
ratings (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references users(id),
  item_id     text not null references items(id),
  score       numeric(3,1) not null,      -- 0.0–10.0, half-steps
  tiebreak    int not null default 0,     -- order within identical score
  logged_at   date not null default current_date, -- diary date (re-loggable)
  created_at  timestamptz default now(),
  unique (user_id, item_id, logged_at)    -- one entry per item per day
)

-- reviews: optional long-form text attached to a rating.
reviews (
  id          uuid primary key default gen_random_uuid(),
  rating_id   uuid not null references ratings(id) on delete cascade,
  user_id     uuid not null references users(id),
  body        text not null,
  created_at  timestamptz default now()
)

-- comparisons: the banked log (enables future Elo). Mirrors ComparisonEvent.
comparisons (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references users(id),
  item_type   text not null,              -- which ranked list
  winner_id   text not null references items(id),
  loser_id    text not null references items(id),
  created_at  timestamptz default now()
)

-- concerts: live shows (the "map" mechanic).
concerts (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references users(id),   -- the logger
  artist_id   text references items(id),
  artist_name text not null,
  venue       text,
  city        text,
  lat         numeric, lng numeric,        -- for a future map view
  show_date   date not null,
  score       numeric(3,1),                -- rate the performance
  tiebreak    int not null default 0,
  setlist     text[],
  notes       text,
  created_at  timestamptz default now()
)

-- concert_tags: friends tagged at a show (N:M), with confirm.
concert_tags (
  concert_id  uuid references concerts(id) on delete cascade,
  user_id     uuid references users(id),
  status      text not null default 'pending', -- 'pending'|'confirmed'
  primary key (concert_id, user_id)
)

-- lists: user-curated ordered collections.
lists (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references users(id),
  title       text not null,
  description text,
  is_ranked   boolean default false,
  created_at  timestamptz default now()
)
list_items (
  list_id     uuid references lists(id) on delete cascade,
  item_id     text references items(id),
  position    int not null,
  note        text,
  primary key (list_id, item_id)
)

-- follows: social graph.
follows (
  follower_id uuid references users(id),
  followee_id uuid references users(id),
  created_at  timestamptz default now(),
  primary key (follower_id, followee_id)
)

-- feed_events: the activity spine. payload is type-specific JSON.
feed_events (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references users(id),
  type        text not null,   -- rated|reviewed|logged_concert|made_list|hit_streak|daily_drop
  subject_id  text,            -- item/concert/list id, type-dependent
  payload     jsonb,
  created_at  timestamptz default now()
)

-- taste_profiles: materialized rollup, recomputed on rating write.
taste_profiles (
  user_id       uuid primary key references users(id),
  top_artists   jsonb,   -- [{id,name,count}]
  top_genres    jsonb,
  top_decades   jsonb,
  mean_score    numeric,
  rated_count   int,
  favorites     text[],  -- Top 4 item ids (also drives profile header)
  updated_at    timestamptz default now()
)
```

### 3.3 Client-side seams (mirror the DB, keep screens decoupled)

Add these interfaces alongside the existing ones. Each gets a `Supabase*` impl.

- `RatingsBackend` — replaces the in-memory guts of `useRatings()` (keep the
  hook's public API identical; SPEC §7 seam). Reads/writes `ratings` +
  `comparisons`.
- `SocialBackend` — follows, feed, compatibility.
- `ConcertsBackend`, `ListsBackend`, `ProfileBackend` (taste profile + Top 4).
- `UserLibrary` (§2.A) for the Spotify user-scope import.

> **Migration note:** today `useRatings()` holds state in memory. Move it behind
> `RatingsBackend` so the swap to Supabase is one implementation change, not a
> screen rewrite. Same pattern already used by comments/likes.

### 3.4 Auth (unblocks trustworthy RLS)

Current `LocalAuthBackend` means RLS can't verify the actor (documented trust gap
in `CLAUDE.md`). **Migrate to Supabase Auth** (email/OTP or Spotify OAuth as
identity). Then tighten RLS on all new tables to `auth.uid() = user_id` for
writes, public read where appropriate. Build features against local auth first,
but land the auth migration before any public launch.

---

## 4. UX/UI & Navigation Paradigms

**North star:** high-res album art is the hero; chrome recedes; logging is never
more than 2 taps from anywhere. Dark-first (music apps live at night).

### 4.1 Bottom tab navigation (5 tabs)

Extends the current `src/app/(tabs)/` layout.

| Tab | Route | Purpose |
|---|---|---|
| **Feed** | `index.tsx` | Daily Drop card on top, then friend activity. The social home. |
| **Search / Rate** | `rate.tsx` | Spotify-style sectioned search (exists) + recently-played import tray. The on-ramp to logging. |
| **＋ Log** (center) | `log.tsx` (modal) | Prominent center FAB-style tab. Opens the active-log flow from anywhere. |
| **Ranks** | `leaderboard.tsx` | Your ranked lists + friend leaderboards. |
| **Profile** | `profile.tsx` | Identity: Top 4, stats, ranked lists, concerts, Wrapped. |

### 4.2 Visual hierarchy

- **Album art first.** Grids and rows lead with large, crisp art (`expo-image`,
  `contentFit="cover"`, transitions). Use the largest available Spotify image on
  hero surfaces (`pickLargest` exists in `spotify.ts`).
- **Score as a pill**, high-contrast accent (existing `ScorePill`), consistent
  everywhere an item appears.
- **Type theming.** Songs / albums / artists / concerts each get a subtle icon +
  accent so mixed feeds stay legible.
- **Motion, sparingly.** The artist page record-player animation sets the tone:
  delightful, not noisy.

### 4.3 The seamless logging flow (2-tap target)

```
Anywhere ──tap ＋ or a play in the import tray──►  Log modal
  1. Item confirmed (art, title, artist)
  2. Slider/stepper 0–10 (half-steps)  ── tap ──►  Save
  3. IF tie ──►  A/B card(s): "Which do you prefer?"  (0–2 taps typical)
     escape hatches: "Too close"  |  "Haven't heard it"
  4. Optional: add a review (expandable, never blocking)
  ──►  Toast: "Logged. 🔥 7-day streak"  +  feed_event emitted
```

### 4.4 Signature screens

- **Profile header** — Top 4 as a 2×2 or 1×4 art collage; tap to swap. Stat row
  beneath. This is the share/screenshot artifact.
- **Comparison card** — two covers side by side, big, "◄ prefer" / "prefer ►".
  Fast, tactile, thumb-friendly (haptics via existing `useHaptics`).
- **Concert log** — art + venue + date + friend-tag chips + setlist; badge on save.
- **Wrapped dashboard** — full-bleed, chart-light, export-to-image share cards
  (drives virality; every share is an acquisition surface).
- **Compatibility banner** — on a friend's profile, a bold "84% match" with the
  3 shared favorites that explain it.

---

## 5. Recommended Build Order (for the developer model)

1. **[P0] User-scope Spotify OAuth + `UserLibrary`** — unlocks import; riskiest, so first.
2. **[P0] `RatingsBackend` seam + Supabase persistence** — move ratings off in-memory; wire `comparisons` banking.
3. **[P0] Active-log flow polish** — import tray → 2-tap log → tie-break with escape hatches.
4. **[P0] Follow graph + `feed_events` + feed** — emit events from every log path.
5. **[P0] Taste Compatibility Score** (§2.C algorithm).
6. **[P0] Profile: Top 4 + stat row + ranked lists.**
7. **[P1] Re-rank nudge, Daily Drop, Concerts + tagging, Wrapped dashboard.**
8. **[P1] Auth migration to Supabase Auth + RLS tightening.**
9. **[P2] Lists, badges, Elo engine, Apple Music.**

### Non-negotiable invariants (enforce across all work)

- Screens talk to **seams only** (`useRatings`, `MusicCatalog`, `*Backend`).
- Every log/review/concert/list/drop **emits a `feed_event`** and calls
  **`recordActivity()`**.
- Every comparison is **banked** to `comparisons` (never discard head-to-heads).
- Logging is **active** — imported plays are candidates, not diary entries.
- New DB tables ship with **RLS**; writes scoped to the actor once Supabase Auth lands.

---

## Appendix — Key Features traceability

| Key Feature (your brief) | Where in this blueprint | Status in codebase |
|---|---|---|
| Comparative Ranking (Beli mechanic) | §1.2, §2.B (re-rank nudge) | **Engine exists** (`RatingTiebreakEngine`); add nudge surface |
| Live Concert Logging (map mechanic) | §1.2, §2.C, §3.2 `concerts` | New — tables + `ConcertsBackend` |
| Active vs Passive Logging | §2.A, §2.B, §4.3 | Enforce via log funnel; import = candidates only |
| Taste Compatibility Scores | §1.3, §2.C (algorithm) | New — `SocialBackend` + `taste_profiles` |
| Top 4 Profile Showcase | §2.D, §3.2 `taste_profiles.favorites`, §4.4 | New — profile header + `ProfileBackend` |
