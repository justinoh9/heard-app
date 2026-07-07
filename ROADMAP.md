# Heard — Roadmap

> **North star:** Beli × Letterboxd for music. The product wins when logging
> music is a 2-tap habit, your ranked list feels like *you*, and your friends'
> activity gives you a reason to open the app every day.
>
> Companion docs: `SPEC.md` (rationale), `PRODUCT_BLUEPRINT.md` (mechanics +
> data models). This file is the *sequenced* plan as of 2026-07-07, reflecting
> what is actually built. Findings referenced as (R1)–(R12) come from the
> 2026-07-07 full-codebase review.

## Where we are

Built and cloud-backed (Supabase): auth (Supabase Auth + RLS hardened via
`0007`), ratings + comparison banking, follow graph + activity feed, profiles +
Top 4 favorites, concerts + friend tags, comments, likes. Built but
device-local or in-memory: streaks (by design), playlists, daily drop. Still
mock: leaderboard users, item-page friend/global score breakdowns, feed filler
cards, the comments "friends" filter roster.

---

## Phase 0 — Stabilize what exists (days, not weeks)

Bug fixes and trust gaps from the code review. Do these before building more —
they're cheap now and expensive after launch.

- [x] **(R1) Fix `release_year` dropped on load** — `SupabaseRatingsBackend.load`
      doesn't select `items.release_year`, so every persisted rating loses its
      year on reload and Wrapped's decades section silently empties.
- [x] **(R2) Bring `setup.sql` / `reset.sql` up to `0007`** — a fresh project
      bootstrapped from either script gets the old *permissive* RLS
      ("anyone can insert as any user_id"). Fold the hardened policies in.
- [x] **(R3) Stop showing the demo seed as other users' data** — `user/[id].tsx`
      falls back to `INITIAL_RANKED` for anyone without stored ratings, so two
      brand-new users see identical fake lists and a near-perfect "taste match".
      Show a real empty state instead; keep the seed only as *local* first-run
      demo content, and never persist it as real ratings on first commit.
- [x] **(R4) Add owner-delete RLS policies + UI** — there is no delete policy
      (or UI) for comments, ratings, concerts, or feed events. Users must be
      able to remove their own content (also a store-review requirement).
- [x] **(R5) Guests should see like counts** — `useLikeSummary` skips loading
      entirely without a userId; public item pages show 0 likes to guests.
- [x] **(R6) Subscribe to `onAuthStateChange`** — `AuthProvider` reads the
      session once; token revocation/expiry or multi-tab sign-out never updates
      UI state.
- [x] **(R7) Tighten `items` update policy** — any signed-in user can rewrite
      any item's title/art for everyone (shared-cache vandalism). Restrict
      updates to same-values upsert semantics or validate fields.
- [x] **(R8) Refresh stale docs** — `CLAUDE.md` ("auth is still local") and
      `HANDOFF.md` (pre-social-era) contradict the code; they will misdirect
      future work.

## Phase 1 — Make the social core real (the "Letterboxd" half)

Replace every mock surface with live data so the loop (log → feed → react →
follow) is entirely real.

- [ ] **Real leaderboard** — replace `LEADERBOARD_USERS` with aggregates over
      `ratings` / `concerts` / `feed_events` (a Postgres view or RPC), scoped
      Global vs. Following. Add a weekly-reset friend leaderboard for recency.
- [ ] **Real score breakdowns** — replace `social/scores.ts` (deterministic
      fake friend scores) with actual friend + global averages from `ratings`.
      An item page showing "your friends rated this 8.2" with *fabricated*
      numbers is the single most trust-damaging mock left (R9).
- [ ] **Reviews as first-class objects** — today a review is just a comment,
      and the `rated` feed event fires *before* the review text exists, so
      reviews never ride the feed (R10). Attach review text to the rating,
      emit one `rated`+review event, and let reviews collect likes/comments.
      This is Letterboxd's core content engine.
- [ ] **Feed v2** — retire the mock filler cards (or clearly demote them for
      empty-feed cold start only); add pull-to-refresh + cursor pagination
      (`feedFor` is a flat 50-row fetch); wire the comments "friends" filter to
      the real follow graph instead of the hardcoded name roster.
- [ ] **Persist the Daily Drop** — `useFeedState` is in-memory: the drop
      vanishes on reload, and "daily" isn't enforced (R11). Add a `drops` table
      (one per user per day, 24h visibility) so the audio-BeReal mechanic is
      real. The static "2h left" mock label becomes a real countdown.
- [ ] **Persist playlists → Lists** — playlists are seeded in-memory (R12).
      Ship the `lists`/`list_items` tables from PRODUCT_BLUEPRINT §3.2 behind a
      `ListsBackend`, emit a `made_list` feed event, and make lists shareable.
      Lists are Letterboxd's virality engine — worth doing properly.

## Phase 2 — Retention & identity (the "Beli" half)

- [ ] **Onboarding wizard** — after sign-up: connect Spotify → rapid-rate ~10
      of your top tracks (seeds the engine + taste profile) → suggest 3–5
      people to follow by artist overlap. Biggest single lever on D1 retention;
      all the ingredients (`UserLibrary`, engine, compatibility) already exist.
- [ ] **Listen diary (re-logging)** — ratings are currently one-per-item;
      Letterboxd's habit loop depends on dated, repeatable log entries. Add
      `logged_at` diary entries (schema already sketched in blueprint §3.2) so
      re-listening an album on a new date is a new diary row feeding streaks
      and Wrapped, while the ranked list keeps one canonical score.
- [ ] **Per-type ranked lists** — songs, albums, and concerts as separate
      tabs on the profile (engine is already type-agnostic).
- [ ] **Taste profile page** — top genres (Spotify artist genres, cached on
      `items`), decades, mean score, most-logged artist. Powers compatibility
      and gives the profile its "here's who you are" payoff.
- [ ] **Notifications** — new follower, comment on your review, concert tag,
      taste-twin rated something you haven't heard. In-app first, push later.
      Without this, every social action is a message into the void.
- [ ] **Re-rank nudge v2** — the quick-match card exists; add the post-log
      1-in-N prompt so comparison data compounds passively.

## Phase 3 — Differentiators (what neither Beli nor Letterboxd has)

- [ ] **Concert layer v2** — the stated wedge. Venue autocomplete + lat/lng
      (columns already exist), a map view of shows attended, an upcoming-shows
      wishlist ("want to go" = Beli's bookmark), and a real tag-confirmation
      flow (tags are auto-'pending' today; tagged users can neither confirm
      nor remove themselves — RLS allows only the owner to insert).
- [ ] **Share cards** — image export for Wrapped, Top 4, and "my #1 of 2026".
      Every share is an acquisition surface; this is how Letterboxd grew.
- [ ] **Badges / achievements** — concert milestones, genre explorer, streak
      tiers, "first to rate". Cheap retention on top of existing counts.
- [ ] **Elo engine** — `EloEngine implements RankingEngine`, replayed from the
      banked `comparisons` table (the whole reason it's been logged since day
      one). Ship behind a flag; compare orderings before switching.

## Phase 4 — Launch readiness & scale

- [ ] **Moderation & safety** — report/block users, comment moderation, rate
      limits. Required before any public launch of user-generated content.
- [ ] **Display-name propagation** — names are denormalized into
      `feed_events`/`comments` at write time; renames never propagate. Join
      through `profiles` (or backfill on rename).
- [ ] **Scale the reads** — `listProfiles()` fetches every profile (the People
      directory won't survive real user counts); add search + pagination.
      Paginate comments. Consider Supabase Realtime for the feed.
- [ ] **Spotify proxy mode everywhere** — retire the in-bundle client secret
      (direct mode) in favor of the `spotify-token` Edge Function; later move
      search fully server-side.
- [ ] **Apple Music (MusicKit)** — second `MusicCatalog` provider; widens the
      funnel beyond Spotify users.
- [ ] **Analytics** — instrument the funnel (sign-up → first log → first
      follow → D7 return) so the roadmap above can be re-prioritized on data.

---

## Goals to steer by

1. **Time-to-first-log < 2 minutes** from install (onboarding wizard).
2. **Logs per weekly-active user ≥ 3** (diary + import tray + nudges).
3. **Every meaningful action emits a feed event** and every feed event can be
   reacted to (the compounding loop from PRODUCT_BLUEPRINT §1.3).
4. **Zero fabricated numbers shown to users** — mocks were right for the
   prototype; from Phase 1 on, if we can't compute it yet, we don't show it.
5. **A profile screenshot should sell the app** — Top 4 + stats + ranked list
   is the growth artifact; invest in it before paid acquisition.
