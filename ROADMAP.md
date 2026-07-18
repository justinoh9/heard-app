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
cold-start filler on an empty feed.

**Phases 1, 2 and 4 are complete; Phase 3 is complete bar (F5).** Phase 4 (2026-07-15)
added rate limits, admin report triage, display-name propagation, server-side
browse aggregation, profile search + comment paging, the analytics funnel, and
invites — and retired a Spotify client secret that was live in the public bundle.
Two items remain, and **neither is blocked on code**: shipping to the app stores
needs paid developer accounts (the review-compliance work itself is done), and the
Pro tier needs a payment-rails decision that shouldn't be guessed at.

Every migration from `0021` on **self-tests when you run it**, and
`npm run test:migrations` replays the whole chain into a throwaway Postgres
container — see CLAUDE.md → Commands.

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

- [x] **Concert layer v2** — the stated wedge. **Shipped 2026-07-14
      (`0017_concert_v2.sql`):** a dedicated `/concerts` screen (Attended / Want
      to go / Invites tabs); a **"want to go" wishlist** (`concerts.status`
      attended|wishlist — a wishlist entry is silent, no feed event, and can be
      promoted with "I went"); and a real **tag-confirmation flow**
      (`concert_tags.status` pending|confirmed — a tagged friend gets an Invite
      to confirm "I was there" or decline; only confirmed tags count toward
      their attended map). Pure `rows.ts` gains `attendedFor`/`wishlistFor`/
      `invitesFor` (unit-tested); backends read tag status via `select *` and
      degrade gracefully pre-migration (attended logging keeps working; only the
      new actions need 0017). Profile "shows" now counts attended-only and links
      to `/concerts`.
      **The map shipped 2026-07-15 (`0018_concert_geo.sql`)** — nullable
      `lat`/`lng` on `concerts`, fed by keyless **venue autocomplete** (Photon /
      OpenStreetMap behind a `VenueGeocoder` seam; Nominatim's policy forbids
      per-keystroke queries, Photon exists for it). The map itself is a
      **stylized SVG poster**, not a tile map: `concerts/world.ts` holds coarse
      coastlines as `[lng,lat]` rings, `concerts/map.ts` projects them through
      the *same* equirectangular function as the show pins (so land and dots
      can't drift apart) and auto-fits the viewBox to where you've actually
      been. Chosen over `react-native-maps` (native-only — the web deploy is the
      ad surface) and Leaflet (DOM-only, and would risk the static export):
      zero new dependencies, reuses `react-native-svg`, renders identically on
      web/native/SSG. Pure + unit-tested (`map.test.ts`, `world.test.ts` — the
      latter enforces ring simplicity and keeps cities on land / seas wet, after
      a self-intersecting draft painted the Mediterranean solid).
      *Follow-ups:* a public map on `/user/[id]`, backfilling coordinates for
      already-logged venues, and clustering if anyone logs hundreds of shows.
- [x] **Share cards** — **all four variants shipped** (2026-07-18). The share
      modal (`src/app/share-card.tsx`) now offers **Wrapped / Top 4 / Artist /
      Decade** chips over one branded `CardShell` (wordmark + `myjelli.site`
      footer, `components/share-card.tsx`): the original Wrapped/#1 card, the
      Top 4 as a 2×2 cover grid, and artist/decade spotlights fed by pure,
      unit-tested `src/share/cards.ts` (`artistSpotlight` / `decadeSpotlight` —
      most-rated artist with ties by mean, most-rated decade with ties to the
      newer). Variants with nothing to show don't offer their chip. Export path
      unchanged (`src/share/export.ts`); the web capture was smoke-tested
      signed-in (2026-07-18): all four variants rendered, the PNG download
      fired, and the `shared` analytics event tracked with
      `surface: '<variant>_card'`. *Remaining:* the same smoke test on a real
      device once the native builds exist (G5).
- [x] **Badges / achievements** — shipped 2026-07-14 (`src/badges/`,
      `src/app/badges.tsx`, a Badges card on the Profile). 16 badges across 6
      families (logging milestones, concert milestones, genre explorer, decade
      range, streak tiers, rating style) computed by pure, unit-tested
      `compute.ts` over the ranked list + concerts + streaks — **no migration**,
      it's a read-time fold over counts that already exist. Earned and
      in-progress are shown separately so the next one is always visible.
      *Follow-up:* a feed event when a badge is earned (currently silent).
- [~] **Elo engine** — **shipped 2026-07-14.** `EloEngine implements
      RankingEngine` (`src/ranking/engine.ts`), replaying the banked
      `comparisons` through pure, unit-tested `elo.ts` (`computeEloRatings` /
      `rerankByElo` — Elo reorders only *within* a score group, so score still
      does the coarse sort). The `RankingEngine` interface gained `order(list,
      events)` (tie-break engine → `sortRanked`, Elo engine → `rerankByElo`);
      the store now routes display order through `engine.order`. Surfaced as a
      **"Head-to-head" toggle** on the Profile RANKED list (a compare-orderings
      view, off by default — `countMoved` shows how many the log reorders). The
      shipped default stays the tie-break engine; the swap is one line.
      *Remaining:* make it the default (or a persisted global setting) once
      orderings are validated on real data.
- [ ] **(F5) Timestamped comments — react to a moment in a song** —
      SoundCloud's signature mechanic: comments anchored to a position in the
      track and shown on a scrub bar during playback. A real differentiator
      neither Beli nor Letterboxd has; depends on (F2) playback plus a
      `position_ms` column on comments.
- [~] **(G2) Browse & discovery surfaces** — **shipped: a Browse tab**
      (`src/app/(tabs)/browse.tsx`, `/browse`) with **Trending this week**,
      **Top rated**, and **genre chips** that filter the list — all over real
      community `ratings`×`items`. Behind a `BrowseBackend` seam (`src/browse/`,
      Supabase + AsyncStorage), the Supabase impl reads the joined ratings in one
      query and folds them through pure, unit-tested `aggregate.ts`
      (`trending`/`topRated`/`forGenre`/`browseGenres`) — the same "select then
      tally" posture as the leaderboard. Guest-browsable, and carries a second
      AdSlot placement (`EXPO_PUBLIC_ADSENSE_SLOT_BROWSE`) so the discovery pages
      earn. **2026-07-14 follow-ups shipped:** decade browsing (chips over
      `browseDecades`/`forDecade`); a **"Popular among people you follow"**
      section (pure `recommendations/popular.ts` over the friend lists the
      For-you hook already fetches); and **crawlable `/browse/genre/[slug]`
      landing pages** — ten curated genres (`src/browse/genres.ts`) statically
      exported via `generateStaticParams` with unique intro copy each, linked
      from a "Browse by genre" section and listed in `sitemap.xml` (the
      SEO/AdSense surface). **New releases shipped 2026-07-18:** Apple retired
      the dedicated new-music RSS (v2 404s), so `src/music/apple-rss.ts` (pure,
      unit-tested) reads the **most-played albums chart** — whose entries carry
      `releaseDate` — and keeps the ≤90-day slice, newest first. The feed sends
      no CORS headers (verified in-browser: iTunes search passes, this API
      doesn't), so on web the transport (`apple-rss-request.ts`) fetches a
      same-origin **Vercel rewrite** (`/feeds/new-releases-albums.json` in
      `vercel.json`); native fetches Apple directly. On the dev server the
      proxy path 404s and the section just doesn't render — same graceful
      posture as a failed fetch. Album ids are iTunes collectionIds, so rows
      open `/item/[id]` like any searched album. The Phase-4 move to Postgres
      views/RPCs is done (0024).
- [~] **(G3) Recommendations** — **shipped: a "For you" row** at the top of the
      Browse tab for signed-in users. `src/recommendations/` — pure, unit-tested
      `recommend.ts` takes the followed friends' ranked lists (via a thin
      `RecommendationsBackend` seam, Supabase one-query + AsyncStorage), scores
      each friend's taste match with `social/compatibility`, and surfaces their
      high ratings (≥8) on music the viewer hasn't logged — each pick attributed
      to the most-compatible friend who loved it ("Maya rated 9.2 · 88% match").
      `use-recommendations.ts` fetches once per follow-set and recomputes locally,
      so rating something drops it from the list instantly. **The taste-twin
      notification shipped 2026-07-18:** pure, unit-tested
      `src/notifications/taste-twin.ts` picks the twin (most-compatible
      followee, ≥50% floor — below that "taste twin" would be a lie) and pings
      their ≤14-day ratings ≥8 on music the viewer hasn't logged, capped at 3.
      Derived at read time like every other notification source: the
      notifications store fetches the same friend lists the recommender uses
      (`friendLists` now returns each rating's `ratedAt` — Supabase
      `created_at`; local snapshots have none and so never ping) and folds
      locally, so rating something drops its ping instantly. Twin rows open
      the item page; blocked users are filtered like every source.
      *Remaining:* a dedicated `/for-you` screen if the row wants to page.

## Phase 4 — Launch readiness & scale

- [~] **Moderation & safety** — **blocking + reporting shipped 2026-07-15**
      (`src/moderation/`, `0019_moderation.sql`). Blocks and reports are the
      app's only **private-read** tables: your block list is visible to you
      alone, and a report only to you and a reviewer — a blocked or reported
      user must never be able to discover it, or the feature invites the
      retaliation it exists to prevent.
      **Read side:** pure, unit-tested `filter.ts` applied *in the stores*
      (social feed + people, comments, notifications) rather than the screens,
      so a new surface can't forget to hide someone; `hideBlockedEvents` also
      drops reposts *of* a blocked user, and `buildThreads` takes their replies
      with them. Filtering is client-side — the rows are still public, so this
      is "I don't have to see you", not a privacy boundary.
      **Write side (the part that actually bites):** 0019 tightens the `follows`
      and `concert_tags` insert policies so someone you blocked cannot follow or
      tag you, and adds the missing "remove own follower" delete policy so a
      block can sever the incoming follow (0007 only let you drop your own).
      **UI:** an overflow menu on `/user/[id]` and on other people's comments
      (block behind a confirm, since it severs follows), a `/report` modal with
      7 reasons + optional note, and `/blocked` (Settings → PRIVACY & SAFETY) to
      unblock. Notifications gained an `actorId` so blocking filters by identity
      rather than by non-unique display name.
      **Account deletion shipped 2026-07-15** (`0020_account_deletion.sql`):
      Settings → ACCOUNT → Delete account, behind a confirm that names what's
      destroyed. Implemented as a `security definer` Postgres function
      (`delete_own_account()`) rather than an Edge Function: removing the
      `auth.users` row needs privileges the client can't have, and the usual
      answer (a function holding the service-role key) would mean the Supabase
      CLI, a deploy step, and a second home for secrets — where this project
      already applies SQL by hand. It's safe because it takes **no arguments**
      (target derives from `auth.uid()`, so a caller can't name a victim) and
      pins `search_path = ''` with every name qualified. Deletes across all 16
      user-keyed tables + the avatar in Storage; deliberately spares
      `public.items` (shared catalog cache, no personal data). Exposed through
      the `AuthBackend` seam as a **required** method — a backend that can create
      accounts but not delete them is the exact gap this closes.
      **Rate limits shipped 2026-07-15** (`0021_rate_limits.sql`). One generic
      `enforce_rate_limit()` trigger, parameterized by the **actor column** —
      because `follows` records the actor in `follower_id` and `reports` in
      `reporter_id`, so a hardcoded `user_id` would have throttled the victim
      instead of the abuser. `concert_tags` needs its own limiter: its `user_id`
      is the person *tagged*, while the tagger is the concert's owner. AFTER …
      FOR EACH STATEMENT (one COUNT per statement, and visibility guaranteed by
      definition rather than by plpgsql's snapshot behaviour — which was checked,
      not assumed). SECURITY DEFINER because reports are private-read and RLS
      would otherwise truncate the COUNT to zero, making the limiter decorative.
      `blocks` is deliberately unlimited — mass-blocking a brigade is the system
      working. `PT429` surfaces as a real HTTP 429 via PostgREST.
      **Admin review shipped 2026-07-15** (`0023_admin_review.sql`,
      `/admin/reports`). Admins live in a private table rather than a
      `profiles.is_admin` flag (profiles is public-read — a flag publishes the
      moderator list), and no API path grants admin. RLS picks the rows; a
      **column grant** picks the columns, so a reviewer can resolve a report but
      not rewrite its reason. Reviewer + timestamp are stamped from the JWT.
      Banning stays in the Supabase dashboard rather than an RPC that mutates
      `auth.users` — the heaviest action shouldn't sit behind the newest check.
      *Remaining:* nothing blocking. Appeals ("I was blocked/removed, why?") are
      the natural next thing if volume ever justifies it.
- [x] **Display-name propagation** — shipped 2026-07-15
      (`0022_display_name_propagation.sql`). A trigger on `profiles` sweeps
      `feed_events`, `comments`, and repost attribution, plus a one-time backfill
      for names that already drifted. Kept denormalized rather than joined: the
      denormalization is deliberate ("one-query feeds"), renames are rare and feed
      reads constant, and PostgREST can only embed through a real FK — which these
      columns can't have while orphaned local-auth-era rows exist. SECURITY
      DEFINER because a repost's attribution lives on the *reposter's* row, so
      propagating your name means writing rows you don't own.
- [x] **Scale the reads** — shipped 2026-07-15. Browse moved off "select every
      rating and tally in the browser" onto the `browse_items` RPC
      (`0024_browse_rpc.sql`) — past PostgREST's row cap that query would have
      kept succeeding while silently describing an arbitrary subset. It returns a
      union of three top-N picks because no single ORDER BY serves both Trending
      and Top rated. People searches + pages in the database
      (`0025_profile_search.sql`, pg_trgm — the query is an unanchored ILIKE a
      B-tree can't serve), and `/user/[id]` resolves by id instead of scanning the
      directory. Comments page by **root**, not by row (`0026_comment_paging.sql`)
      — a flat page would hand `buildThreads` orphaned replies, which it drops by
      design. *Remaining:* `listProfiles()` is still unbounded, knowingly — the
      item page and tag picker use `people` as a local id→name map, so a cap would
      make them wrong rather than slow; the fix is to make those consumers ask for
      the ids they need. Supabase Realtime for the feed is still unexplored.
- [x] **Spotify proxy mode everywhere** — shipped 2026-07-15, and it was more
      urgent than this line implied: `EXPO_PUBLIC_SPOTIFY_CLIENT_SECRET` was
      **live in the myjelli.site bundle**, readable by anyone. It had zero
      consumers (search is iTunes; `SpotifyCatalog` is never instantiated; the
      user-OAuth flow is PKCE and needs no secret). Fixed by deleting the
      `tokenDirect` code path rather than unsetting the variable — a `.env` line
      is too easy to re-add, and this file's own "switch to the proxy before a
      real launch" comment is the proof. A regression test asserts a secret in the
      env cannot resurrect direct mode. **The secret must still be rotated.**
      *Remaining:* moving search fully server-side is moot while search is iTunes.
- [~] **Apple Music (MusicKit)** — **the stated rationale is obsolete.** This was
      written when Spotify was the only catalog, so "widens the funnel beyond
      Spotify users" was real. Search now runs on **iTunes — Apple's own catalog**
      — keyless, no login, for everyone; the funnel is already as wide as MusicKit
      would make it. What MusicKit would still add is *full-track playback* for
      Apple Music subscribers, which is the actual dependency of (F5) timestamped
      comments. Re-file it there. It needs a paid Apple Developer account and a
      server-signed ES256 developer token, so it is blocked on an account, not on
      a decision.
- [x] **Analytics** — shipped 2026-07-15 (`src/analytics/`, `0027_analytics.sql`,
      `/admin/analytics`). Sign-up → first log → first follow → D7 return,
      cohorted by sign-up date (an all-time-signups-vs-this-week's-activity funnel
      only ever slopes down). Signed-in users only, no free text, no third party —
      which is what lets the deletion promise stay literal; 0027 extends
      `delete_own_account`, the first test of the "hardcoded list rots" warning
      0020 wrote about itself. `signed_up` is recorded by a **trigger on
      `auth.users`**, because an OAuth signup returns through `onAuthStateChange`
      where "signed in" and "signed up" are indistinguishable from the client — so
      a client-side call would have silently counted only the email form.
      *Remaining:* nothing blocking. Per-surface ad revenue attribution would need
      AdSense's own reporting, which is a different system.
- [x] **(F6) Invite system** — shipped 2026-07-15 (`0028_invites.sql`,
      `src/invites/`, `/invite`). **Deliberately NOT invite-gated**, which is a
      change from this line's original ask: gating optimizes for exclusivity at
      the direct expense of the ad impressions the project exists to earn.
      Scarcity is a lever for when there's a queue at the door, and the schema
      supports pulling it later by making `redeem_invite` mandatory at signup.
      What shipped is the part that pays off now: a referral link that seeds a
      **mutual** follow, so nobody lands on the empty feed that kills day one.
      `redeem_invite` is SECURITY DEFINER because a code is a bearer token (no
      select-by-code policy exists — looking one up *is* using it) and because the
      invitee has no right to make the inviter follow back. It returns one `null`
      for every failure so it can't be used as an oracle; one redemption per
      *person*, not per code, or referral credit is farmable.
- [~] **(G5) Ship the native apps** — the app-review *compliance* work is done:
      Apple sign-in (F1), in-app account deletion (0020), blocking + reporting
      for user-generated content (0019), and a published privacy policy. Those
      were the rejection risks.
      **What remains is blocked on accounts, not code**, and deliberately not
      faked: an EAS build needs an Expo account; TestFlight and Play internal
      testing need paid Apple ($99/yr) and Google ($25) developer memberships;
      universal links need a real Apple Team ID + bundle identifier in an
      `apple-app-site-association` file. Writing `eas.json` with invented ids
      would produce config that looks complete and fails at the first build, which
      is worse than an empty file. Once those accounts exist this is an afternoon:
      `eas.json`, bundle ids in `app.json`, AASA + `assetlinks.json` in `public/`,
      store copy, screenshots.
- [ ] **(G6) Paid tier (Pro)** — **this is a decision, not a coding task, and it
      is the founder's.** The blocker isn't the entitlement seam (a `pro` flag
      gating `ad-slot.tsx` is an hour's work); it's choosing the rails, and the
      choice isn't reversible cheaply. Stripe on web is 2.9% and works today; App
      Store IAP is **mandatory** for digital goods in an iOS build and takes
      15–30%; RevenueCat straddles both for a cut. Building the seam before
      picking would mean guessing at whether entitlements are keyed to a Stripe
      customer, an Apple original_transaction_id, or a RevenueCat app_user_id —
      and that guess is the whole schema.
      Worth noting the tension with the stated ad goal: Pro's main perk (ad-free)
      removes the impressions the rest of Phase 4 was built to earn, so Pro only
      makes sense once ARPU-from-ads is known — which the funnel (now shipped) is
      what measures. Sequence: ads earn → measure → then price the escape from
      them. Perks that fit Jelli: full Wrapped history, advanced taste stats,
      unlimited lists, profile themes.

## Polish & quick wins

Small, low-effort improvements that don't warrant a phase — pick them up
between larger work.

- [x] **(F7) Vinyl covers face outward** — shipped (commit `b4a30a1`, this box
      was stale): the rim covers in `RecordPlayer` (`src/app/artist/[id].tsx`)
      rotate radially — `rotate(angle)` then `translateY(-orbit)` with no
      counter-rotation, so each cover's top points away from the spindle.

---

## Growth playbook — Contagious (STEPPS)

Jonah Berger's six reasons things get shared, used here as the lens for
growth work (adopted 2026-07-18). The test for any new sharing/visibility
feature: which principle is it pulling on, and does it make the *user* look
good — not the app? People share things that make them look good, feel
something, or help a friend; the brand rides along (every export already
carries the wordmark + myjelli.site — behavioral residue).

- **Social Currency** (sharing it makes me look good): the share cards
  (Wrapped/#1, Top 4, artist/decade spotlights, the taste **descriptor** on
  the Wrapped card) and **badges** — which now publish a `badge` feed event on
  earn (`0029`, `src/badges/announcer.tsx`), because an achievement nobody
  sees is social currency nobody can spend. *Open:* percentile stats ("more
  albums rated than 94% of Jelli") once the user base supports honest
  percentiles — zero-fabrication rule applies.
- **Triggers** (top of mind → tip of tongue): streaks, the Daily Drop's 24h
  clock, and the **queue trigger** ("a friend rated something on your
  want-to-listen list", `src/notifications/queue-trigger.ts` — the G1
  follow-up, shipped 2026-07-18). *Open:* push notifications (APNs/FCM) are
  the real trigger channel; in-app bells only fire for people already here.
- **Emotion** (high-arousal beats informative): the **taste-match card** — a
  share action on another user's profile exports "{n}% taste match" with the
  albums you both love (`MatchCard`, entered from `/user/[id]`). Surprise +
  affirmation, and it flatters *both* people, so it has two natural sharers.
- **Public** (built to show, built to grow): public profiles, the exported
  cards, badge events in the feed. *Open (next candidates):* the shareable
  `/list/[id]` route (lists follow-up) and the public concert map on
  `/user/[id]` (concert-layer follow-up) — both turn private artifacts into
  linkable, crawlable pages, which also feeds the SEO surface.
- **Practical Value** (useful things get forwarded): Browse's genre landing
  pages, new releases, and the For-you row. *Open:* `/list/[id]` again — a
  ranked list titled "best albums of 2026" is the single most forwardable
  object this app can produce.
- **Stories** (information travels inside narratives): Wrapped is the story
  surface — "my year in music" — and every card is a chapter of it. *Open:* a
  shareable year-end Wrapped sequence (multi-card story export) when December
  arrives.

## Goals to steer by

1. **Time-to-first-log < 2 minutes** from install (onboarding wizard).
2. **Logs per weekly-active user ≥ 3** (diary + import tray + nudges).
3. **Every meaningful action emits a feed event** and every feed event can be
   reacted to (the compounding loop from PRODUCT_BLUEPRINT §1.3).
4. **Zero fabricated numbers shown to users** — mocks were right for the
   prototype; from Phase 1 on, if we can't compute it yet, we don't show it.
5. **A profile screenshot should sell the app** — Top 4 + stats + ranked list
   is the growth artifact; invest in it before paid acquisition.
