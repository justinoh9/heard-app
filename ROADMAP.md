# Heard — Roadmap

> **North star:** Beli × Letterboxd for music. The product wins when logging
> music is a 2-tap habit, your ranked list feels like *you*, and your friends'
> activity gives you a reason to open the app every day.
>
> Companion docs: `SPEC.md` (rationale), `PRODUCT_BLUEPRINT.md` (mechanics +
> data models). This file is the *sequenced* plan as of 2026-07-07, reflecting
> what is actually built. Findings referenced as (R1)–(R12) come from the
> 2026-07-07 full-codebase review; founder feature requests captured
> 2026-07-07 are tagged (F1)–(F7) and slotted into the phase that fits them.

## Where we are

Built and cloud-backed (Supabase): auth (Supabase Auth + RLS hardened via
`0007`), ratings + comparison banking, follow graph + activity feed, profiles +
Top 4 favorites, concerts + friend tags, comments, likes, the real leaderboard
(per-user aggregates), real item-page score breakdowns, the Daily Drop
(`0009_drops.sql`), and playlists-as-Lists (`0010_lists.sql`). Reviews ride one
`rated` feed event and persist as likeable comments; the feed pages backward
and the comments "friends" filter uses the real follow graph. Device-local by
design: streaks. The mock "From the community" cards now appear only as
cold-start filler on an empty feed. **Phases 1 and 2 are complete** — Phase 3
(differentiators) is next.

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

- [x] **Real leaderboard** — `LEADERBOARD_USERS` retired; the Ranks tab now
      loads real per-user aggregates behind `socialBackend.leaderboard()`
      (`src/leaderboard/`), scoped Global vs. Following, with the viewer's live
      client counts merged over the server row. *Follow-up (unbuilt):* a
      weekly-reset friend leaderboard for recency.
- [x] **Real score breakdowns** — `social/scores.ts` deleted; the item page's
      you/friends/global figures are real means over real `ratings` rows
      (`src/social/item-scores.ts` + `use-item-scores.ts`, unit-tested, honest
      empty states). Closes R9.
- [x] **Reviews ride the feed + persist** — the log flow captures the review at
      a dedicated step and defers the commit so one `rated`+review event fires
      (closes R10); the text is also written as a durable, likeable comment on
      the item page (`log.tsx` → `postComment`). *Follow-up (unbuilt):* a
      distinct `reviews` object type with its own detail screen, if reviews
      need to diverge from comments later.
- [x] **Genre pipeline** — iTunes `primaryGenreName` is now captured through
      search → `SearchResult.genre` → `Item.genre` → `items.genres` (the column
      existed since 0003; `ratings-rows` writes/reads it). Surfaced as a "Top
      genres" row on the taste profile (`computeStats` → `computeTasteProfile`).
      Populates for newly-rated items going forward (the `items` cache is
      insert-only, so pre-existing ratings stay genre-less until re-cached).
      *Follow-up:* a genre similarity term in `compatibility` once genres are
      broadly populated (adding it now would dilute existing matches).
- [x] **Feed v2** — pull-to-refresh shipped (jam-jar-lid pull, `JarRefresh`);
      the mock "From the community" filler now shows only on the cold-start
      empty feed (never stacked under real events); the comments "friends"
      filter reads the real follow graph, not the `LEADERBOARD_USERS` roster
      (`src/comments/filter.ts` takes the followed-user name set); and the feed
      pages backward via `feedFor(userIds, limit, before)` + `loadMoreFeed` /
      `feedHasMore` (a "Load more" button). *Follow-up (unbuilt):* feed-event
      reactions (likes/comments start at 0) and a weekly-reset friend board.
- [x] **Persist the Daily Drop** — was in-memory (R11). Now behind a
      `DropsBackend` seam (`0009_drops.sql` — one active row per user, upserted
      on re-post — with Supabase + AsyncStorage impls). 24h expiry lives in the
      pure, unit-tested `src/feed/rows.ts`; the static "2h left" is a real
      countdown (`formatDropRemaining`).
- [x] **Persist playlists → Lists** — was seeded in-memory (R12). Shipped the
      `lists`/`list_items` tables (`0010_lists.sql`) behind a `ListsBackend`
      seam (`src/playlists/`, client module keeps the "playlists" name);
      creating a list emits a `made_list` feed event. *Follow-up (unbuilt):* a
      shareable public `/list/[id]` route (lists are readable but not yet
      openable on another user's device).

## Phase 2 — Retention & identity (the "Beli" half)

- [x] **Onboarding wizard** — shipped (`src/onboarding/`, `src/app/onboarding.tsx`).
      A brand-new user (empty ranked list, not-yet-onboarded) is gated into
      welcome → rapid-rate ~10 curated albums (3 buckets + "haven't heard it") →
      follow taste-matched people (reuses `compatibility`, ranked by
      `rankFollowSuggestions`) → done. Ratings persist via the normal
      `commitPlacement` path; a device-local flag (`flag.ts`) stops it
      reappearing; the gate is `useOnboardingRedirect` in the tabs layout.
      *Deliberate scope cut:* the seed is the app's own catalog search (real
      artwork, works for everyone), **not** Spotify top-tracks — Spotify
      user-OAuth is still gated behind its dev-mode allowlist, so a
      Spotify-first flow would break most signups. Spotify-as-seed is the
      follow-up once the app clears Spotify's quota-extension review.
- [x] **Listen diary (re-logging)** — shipped (`src/diary/`, `0011_diary.sql`,
      `src/app/diary.tsx`). A separate `diary_entries` table (dated,
      re-loggable, `unique(user,item,logged_at)`) records every log action while
      `ratings` stays the one-per-item canonical ranked list. `commitPlacement`
      writes a diary entry alongside the feed event + streak hook; the timeline
      screen groups by day (pure `rows.ts` `groupByDay`, unit-tested), reached
      from a "Your diary" card on the Profile. *Follow-ups:* surface the diary on
      `/user/[id]` (RLS already public-read), and derive streaks from it
      (currently device-local).
- [x] **Per-type ranked lists** — the Profile's ranked list now has
      Albums / Songs tabs (with per-type counts) and `/user/[id]` splits into
      "Their top albums" / "Their top songs". Pure `src/ranking/lists.ts`
      (`rankedOfType` / `typeCounts`, unit-tested) filters the one engine-ranked
      list into type views; concerts keep their own SHOWS section. *Follow-up:*
      true per-type tie-break groups in the engine (today it's a display filter
      over the global order, which reads correctly within each type).
- [x] **Taste profile** — shipped as a reusable "who you are" card
      (`src/taste/profile.ts` pure + tested, `components/taste-profile-card.tsx`)
      on both your own Profile tab and `/user/[id]`. Shows a rating-style
      descriptor (Generous / Critical / Balanced / Polarizing / Getting started,
      derived from mean + histogram), mean score, favorite decade, and
      most-logged artists — all real, reusing `computeStats`. Also retired the
      fake `PROFILE.tags` ("indie · hip-hop") line. Top **genres** now render too
      (see the Genre pipeline item below).
- [x] **Notifications (in-app)** — shipped (`src/notifications/`,
      `src/app/notifications.tsx`, bell + unread badge on the Feed). **Derived**
      at read time from existing tables (no migration, no write hooks): new
      followers (`follows`), comments on music you've rated (`comments`), and
      concert tags (`concert_tags`). Pure `merge.ts` (unit-tested) orders + counts
      unread against a device-local last-seen (`seen.ts`). *Follow-ups:* the
      taste-twin source (needs cross-user compatibility) and push (APNs/FCM).
- [x] **Re-rank nudge v2** — the standing quick-match card on Ranks now has a
      *post-log* sibling: the log flow's done screen offers one quick match
      ~1-in-3 (`shouldNudgeAfterLog`), comparing the just-rated item against a
      never-compared neighbour (`pickNudgeForItem`, both pure + tested in
      `ranking/nudge.ts`; `components/post-log-nudge.tsx`). Every answer banks a
      comparison event (feeding the future Elo engine) and can settle a
      same-score tie on the spot.
- [x] **(F1) Frictionless sign-in — Google/Apple OAuth** — both the sign-in and
      sign-up screens now lead with **Continue with Google** + **Continue with
      Apple** above the email form (`OAuthButton` in `src/auth/ui.tsx`, wired to
      `signInWithOAuth`, which passes the provider straight to Supabase Auth).
      The seam already supported all three providers; this rendered the Apple
      button (required for iOS review) beside the existing Google one.
      *Config on the user:* enable the Google + Apple providers in the Supabase
      dashboard (Auth → Providers) and register the OAuth apps — until then the
      buttons surface a "provider not enabled" error. *Follow-up:* native Apple
      sign-in via `expo-apple-authentication` when the iOS app ships (web uses
      the Supabase redirect flow today).
- [x] **(F2) In-app playback (preview-first)** — shipped. A single shared
      `expo-audio` player (`src/audio/preview.tsx`, mounted in the root layout so
      only one clip sounds at a time) backs a `PreviewButton`
      (`components/preview-button.tsx`) on search rows, album tracklists, and the
      song/album item header. iTunes' 30s `previewUrl` now flows through
      `AlbumTrack` (previously dropped in `parseAlbumTracks`) and the item-route
      params. Renders nothing when a release has no preview. *Follow-ups:* a
      preview affordance on feed cards; full-track playback (Spotify Web Playback
      SDK / Apple MusicKit, premium-gated) is the heavier follow-up and unblocks
      (F5) timestamped comments.
- [x] **(F4) Reposts** — shipped. A **Repost** action on feed cards
      (rated/drop/concert, not your own, real events only) opens a composer
      (`src/app/repost.tsx`) for an optional note and emits a `repost` feed
      event whose payload denormalizes the original content + attribution. The
      card renders it as the original event with a "{user} reposted" line + the
      note (`toDisplayEvent` in `feed-rows.ts`, unit-tested). Only the type
      check widened (`0013_reposts.sql` — same pattern as concert/made_list).
      Extends the compounding loop (§1.3). *Follow-up:* a repost count / "undo
      repost", and dedupe so the same event can't be reposted twice.
- [x] **(G1) "Want to listen" queue** — shipped (`src/queue/`, `0012_queue.sql`,
      `src/app/queue.tsx`). A one-tap bookmark (`components/queue-button.tsx`) on
      item pages + search rows feeds a personal listen-later list behind a
      `QueueBackend` seam (Supabase/AsyncStorage, `provider.ts`), pure
      `rows.ts` (unit-tested), optimistic `useQueue()` store. No feed event — a
      private intent list, distinct from `ratings` (ranked) and `diary` (dated).
      A "Want to listen" card + count sits on the Profile. *Follow-ups:* the
      bookmark on feed cards, and the re-engagement hook ("3 things on your list
      were just rated by friends").
- [x] **(G4) Profile identity basics** — **handles, bios, and avatars shipped.**
      `0014_profile_identity.sql` adds `handle`/`bio`/`avatar_url` to `profiles`
      with a case-insensitive unique index on `handle`; the `SocialBackend` gains
      `updateProfile` (both impls, `HandleTakenError` on collision) and `Profile`
      carries the fields. The Profile tab has an **Edit profile** action
      (`src/app/edit-profile.tsx` — handle normalized to `[a-z0-9_]`, bio,
      optimistic save via the store's `myProfile`/`updateProfile`). **Avatars:**
      `0015_avatars.sql` adds a public `avatars` Storage bucket with owner-scoped
      RLS (`<uid>/avatar.<ext>`); the edit modal picks an image via
      `expo-image-picker` and uploads through `src/social/avatar.ts` (base64 →
      bytes, upsert + cache-buster). A shared `components/avatar.tsx` renders the
      uploaded image or an initials monogram, used on the Profile tab and
      `/user/[id]`; the UI keeps its initials fallback for anyone without a photo.
      *Config on the user:* run `0015` on the Supabase project. *Follow-up:*
      thread `avatarUrl` into feed cards / People rows (those data models
      denormalize `displayName` but not the avatar yet).

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
- [ ] **(F5) Timestamped comments — react to a moment in a song** —
      SoundCloud's signature mechanic: comments anchored to a position in the
      track and shown on a scrub bar during playback. A real differentiator
      neither Beli nor Letterboxd has; depends on (F2) playback plus a
      `position_ms` column on comments.
- [ ] **(G2) Browse & discovery surfaces** — non-social browse both apps have:
      trending this week, top-rated by genre/decade, new releases, "popular
      among people you follow." Jelli has search + feed but no *browse*. Doubly
      valuable here: these are the content-rich, crawlable, ad-friendly pages
      that make the AdSense strategy actually earn (see the ads seam). Build on
      Postgres views over `ratings`/`feed_events`.
- [ ] **(G3) Recommendations** — even the cheap version: "your taste twin rated
      this 9.2 and you haven't heard it." Compatibility scores already exist
      (`src/social/compatibility.ts`), so v1 is a query over followed users'
      high ratings minus what you've logged — not an ML project. Powers a
      "For you" row and a strong notification type.

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
- [ ] **(F6) Invite system (Beli-style)** — invite-gated onboarding + referral
      credit: each user gets a handful of invite codes, joining via a code links
      inviter↔invitee (seeding the follow graph immediately), and
      invites-remaining becomes a status nudge. Beli's core growth + scarcity
      loop; pairs with the share cards above as an acquisition surface.
- [ ] **(G5) Ship the native apps** — the roadmap plans features but not
      distribution. To be "fully fledged like Beli/Letterboxd" means being *in
      the stores*: EAS build pipeline, TestFlight + Play internal testing,
      store listings + screenshots, and app-review compliance — Apple sign-in
      (already noted in F1) and in-app account deletion (RLS exists via `0008`;
      needs a Settings action). Plus deep links so a shared
      `myjelli.site/item/…` opens the app instead of the browser.
- [ ] **(G6) Paid tier (Pro)** — Letterboxd monetizes with Pro/Patron
      (ad-free + advanced stats); income is a stated goal. Decide the shape
      early: free-with-ads / Pro-ad-free is proven, and the env-gated ad seam
      (`src/components/ad-slot.tsx`) already makes "ad-free for Pro users" a
      per-user toggle later. Pro perks that fit Jelli: full Wrapped history,
      advanced taste stats, unlimited lists, profile themes.

## Polish & quick wins

Small, low-effort improvements that don't warrant a phase — pick them up
between larger work.

- [ ] **(F7) Vinyl covers face outward** — on the artist page's spinning-record
      hero (`RecordPlayer` in `src/app/artist/[id].tsx`), rotate each rim album
      cover radially so it faces away from the center instead of sitting
      upright, so the disc reads like real objects on a turntable.

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
