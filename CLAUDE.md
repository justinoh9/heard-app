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
- **Analytics** (`src/analytics/`, ROADMAP Phase 4) — the funnel (sign-up → first
  log → first follow → D7 return) behind an `AnalyticsBackend` seam
  (`0027_analytics.sql`; Supabase or a no-op Local impl). Signed-in users only
  (`user_id` is NOT NULL and the insert policy demands it match `auth.uid()`, so a
  guest generates no row), no free text, no third party — which is what keeps
  "delete my account" literal, since 0027 also extends `delete_own_account`.
  Events are **raw**: there is no `first_rating`, because "first" is a read-time
  question (`min(created_at)`). There is **no `signed_up` event**: the cohort is read
  from `auth.users.created_at`, which already knows. A client can't tell a first
  OAuth sign-up from a sign-in (both arrive via `onAuthStateChange`), and a
  trigger on `auth.users` — the first attempt — is refused outright, since that
  table is owned by `supabase_auth_admin` while the SQL editor runs as `postgres`.
  Reading it needs no privilege, can't drift, and counts accounts created before
  analytics existed. **Migrations must never create a trigger on, or write to,
  `auth.users`** — `test:migrations` lints for it, because the local container is
  a superuser and would happily accept what production refuses. `analytics_funnel()` is
  admin-only *inside the function* (there's no read policy at all), cohorted by
  sign-up date, and rendered by `src/app/admin/analytics.tsx`.
- **Invites** (`src/invites/`, ROADMAP F6) — `0028_invites.sql`. Deliberately a
  referral link, **not invite-gated signup**: gating would optimize for
  exclusivity at the direct expense of the ad impressions this app exists to
  earn. Scarcity is a lever for when there's a queue at the door; the schema
  supports pulling it later. Redeeming seeds a **mutual** follow so nobody starts
  on an empty feed. `redeem_invite` is `security definer` because a code is a
  bearer token (no select-by-code policy exists — being able to look one up is
  being able to use it) and because the invitee has no right to make the *inviter*
  follow them. It returns a single `null` for every failure — wrong / spent /
  yours / already-used-one — so it can't be used as an oracle to test guesses.
  One redemption per person, not per code, or referral credit is farmable.
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
  **It is proxy-only, and there is no client-secret env var any more** (Phase 4).
  The secret used to be read from `EXPO_PUBLIC_SPOTIFY_CLIENT_SECRET`, which Expo
  inlines into the bundle — so it shipped, publicly readable, on myjelli.site. The
  `tokenDirect` path is **deleted rather than discouraged**: a comment saying "use
  the proxy before a real launch" did not survive contact with a deploy, and a
  code path that cannot read a secret does. `SpotifyCatalog` now takes its token
  only from the `spotify-token` Edge Function (`EXPO_PUBLIC_SPOTIFY_TOKEN_URL`),
  and a regression test asserts that a secret in the env does *not* resurrect
  direct mode. The client **ID** stays public on purpose — the user-OAuth flow is
  PKCE, which is built for clients that can't keep a secret. (Expo only inlines
  `EXPO_PUBLIC_*` vars the code actually references, so deleting the read is what
  stops the leak — verified, not assumed.)
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
    (ships now) + `EloEngine`. Score does the coarse sort; comparisons binary-insert
    within a tie group. Escape hatches on `Placement`: `skip()` ("haven't heard it"
    — opponent keeps its slot) and `tooClose()` (settle below the opponent); neither
    logs a comparison event. See SPEC §5. The interface's `order(list, events)` owns
    display order — the store routes through it (tie-break → `sortRanked`, Elo →
    `rerankByElo`).
  - `elo.ts` — the alternate ordering (ROADMAP Phase 3): replays the banked
    `comparisonLog` into per-item Elo (`computeEloRatings`) and reorders *within*
    each score group (`rerankByElo`), so score still gates. `EloEngine` wraps it;
    surfaced as the Profile RANKED "Head-to-head" toggle (`countMoved` captions how
    many the log moves). Off by default — a compare-orderings view, not the shipped
    default engine yet. Pure + unit-tested (`elo.test.ts`).
  - `nudge.ts` — the re-rank "quick match" (blueprint §2.B): picks an adjacent
    never-compared pair (same-score pairs preferred — those can actually swap;
    cross-score answers are banked only). Rendered by
    `src/components/quick-match-card.tsx` at the top of the Ranks tab, applied
    through `commitPlacement`.
  - `lists.ts` — pure per-type views of the ranked list (`rankedOfType` /
    `typeCounts` / `defaultListType`), driving the Profile's Albums/Songs tabs
    and `/user/[id]`'s "top albums / top songs" split. A display filter over the
    single engine-ranked order; concerts rank separately.
  - `engine.test.ts`, `nudge.test.ts`, `lists.test.ts` — unit tests for
    tie-break + nudge + per-type logic.
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
  `/user/[id]` (it also retired the fake `PROFILE.tags` line). **Genres** flow
  through the pipeline: iTunes `primaryGenreName` → `SearchResult.genre` →
  `Item.genre` (threaded through the rate route params) → `items.genres`
  (`ratings-rows`) → `computeStats.topGenres` → the card. Populates for
  newly-rated items only (the `items` cache is insert-only).
- `src/notifications/` — in-app notifications (ROADMAP Phase 2), **derived** at
  read time from existing tables (no migration, no write hooks):
  `SupabaseNotificationsBackend` queries `follows` (new followers), `comments`
  on your rated items, and `concert_tags` (tags), resolving actor names via
  `profiles`; a `Local` no-op backend + `provider.ts` complete the seam. Pure
  `merge.ts` (unit-tested) orders + counts unread against a device-local
  last-seen (`seen.ts`); `store.tsx` (`useNotifications`, mounted below ratings)
  feeds the Feed-header bell/badge and `src/app/notifications.tsx`.
- `src/auth/` — `useAuth()`/`AuthBackend` seam; `SupabaseAuthBackend` (real
  accounts, session persisted by the shared client, `onAuthStateChange`
  tracked) or `LocalAuthBackend` (AsyncStorage + expo-crypto) chosen by env in
  `provider.ts`. `use-require-auth.ts` gates account-only actions/screens;
  browsing is open to guests (`GuestGate` for personal surfaces).
  **Account deletion** (`deleteAccount()`, a *required* seam method — an auth
  backend that can create accounts but not delete them is exactly the gap Apple
  rejects for): the Supabase impl calls the `delete_own_account()` RPC
  (`0020_account_deletion.sql`), a `security definer` function — deleting the
  `auth.users` row needs privileges the client can't hold, and this avoids an
  Edge Function + service-role key + CLI deploy. It takes **no arguments** (the
  target is `auth.uid()`, so a caller can't name a victim) and pins
  `search_path = ''` with everything schema-qualified. It clears all
  user-keyed tables and deliberately spares `public.items`
  (shared catalog cache — no personal data, and other users' ratings point at
  it). The Local impl **sweeps keys by pattern** (`heard.*.<userId>`) rather
  than a hardcoded list, because a literal list silently rots the next time a
  feature adds a per-user key — a deletion that quietly misses data is worse
  than one that fails loudly. UI: Settings → ACCOUNT → Delete account, behind an
  `ActionMenu` confirm that names what's destroyed.
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
  `made_list`, and the feed's **Repost** action publishes `repost`
  (`0013_reposts.sql` widened the type check; `src/app/repost.tsx` composes the
  optional note; the payload denormalizes the original content + attribution, so
  `toDisplayEvent` renders a repost as the original card with a "reposted by"
  line). The feed pages backward via `feedFor(userIds, limit, before)`
  (cursor = the oldest event held); the store exposes `loadMoreFeed` +
  `feedHasMore`. `src/app/people.tsx` is the directory with follow toggles; the
  Feed tab renders real events, and the mock "From the community" filler shows
  **only on the cold-start empty feed** (never stacked under real activity —
  ROADMAP goal #4). The comments "friends" filter (`src/comments/filter.ts`)
  now takes the real followed-user name set, not a mock roster. `compatibility.ts` is the pure taste-match
  algorithm (blueprint §2.C) shown on `src/app/user/[id].tsx` — another user's
  profile (% match + shared favorites + their ranked list via
  `ratingsBackend.load`), reached from People rows and feed avatars.
  **Profile identity** (ROADMAP G4): `Profile` carries a unique `@handle`, a
  `bio`, and an `avatarUrl` (`0014_profile_identity.sql` — case-insensitive
  unique index on `handle`); `SocialBackend.updateProfile` (both impls,
  `HandleTakenError` on collision) writes them, the store exposes
  `myProfile`/`updateProfile`, and `src/app/edit-profile.tsx` edits handle + bio.
  Handle + bio render on the Profile tab and `/user/[id]`. **Avatar upload**
  ships too: `0015_avatars.sql` adds a public `avatars` Storage bucket
  (owner-scoped RLS on `<uid>/avatar.<ext>`); the edit modal picks via
  `expo-image-picker` and uploads through `src/social/avatar.ts` (base64→bytes,
  upsert + cache-buster), and the shared `components/avatar.tsx` renders the
  image or an initials monogram (initials fallback for anyone without a photo).
  **Scale** (Phase 4): `searchProfiles({query, limit, offset})` searches + pages
  in the database (`0025_profile_search.sql` — pg_trgm GIN indexes, because the
  query is an *unanchored* `ilike '%maya%'` that a B-tree can't serve), exposed as
  `useSocial().searchPeople` — on the store, not the backend, because blocked
  users are filtered in stores and a screen calling the backend directly would
  quietly show them. `profilesByIds` resolves specific people, and `/user/[id]`
  uses it rather than scanning a directory it can no longer assume is complete.
  `listProfiles()` stays unbounded on purpose: several screens use `people` as a
  local id→name map, so capping it wouldn't make them slower, it would make them
  silently *wrong*.
  `favorites.ts` resolves the **Top 4 showcase** (blueprint §2.D): chosen ids
  live on `Profile.favorites` (`0005_favorites.sql`; `saveFavorites` in the
  store), edited on the Profile tab (Edit → remove/add via picker sheet, with
  a top-of-ranked fallback until chosen) and shown on `/user/[id]`.
  `scores.ts` (mock friend-score chrome) predates this and still backs the
  item page's fake breakdowns.
- `src/concerts/` — live show logging (blueprint §2.C, the "map" mechanic):
  `useConcerts()` in `store.tsx`, `ConcertsBackend` seam (Supabase
  `0006_concerts.sql` + `0017_concert_v2.sql` / AsyncStorage, chosen in
  `provider.ts`), pure `rows.ts` (unit-tested). Logged via
  `src/app/concert/new.tsx` (modal: artist/venue/date/score + friend-tag
  chips; `?wishlist=1` switches it to a scoreless "want to go" add).
  **Concert v2:** a show carries a `status` (`attended` | `wishlist`) and its
  tags carry a `status` (`pending` | `confirmed`). `rows.ts` slices the viewer's
  shows into `attendedFor` (owned + confirmed-tagged attended — the live-music
  map + the Profile "shows" count), `wishlistFor` (own want-to-go), and
  `invitesFor` (pending tags to confirm/decline). The dedicated
  `src/app/concerts.tsx` (`/concerts`, pushed from the Profile SHOWS header and
  shows stat) has Attended / Want to go / Invites tabs; the store exposes
  `logConcert`/`markAttended`/`removeConcert`/`confirmTag`/`declineTag`. An
  attended log publishes a `'concert'` feed event + streak tick; a wishlist add
  is silent (private intent). Backends read tag status via `select *` and
  degrade gracefully pre-0017 (missing status → attended/confirmed; attended
  logging still works — only wishlist/confirm/mark-attended need the migration).
  **The map** (`0018_concert_geo.sql` — nullable `lat`/`lng`): venue
  autocomplete runs on **Photon** (`geocode.ts`, the `VenueGeocoder` seam,
  singleton in `provider.ts`) — an OpenStreetMap geocoder picked for the same
  reasons as iTunes: keyless, no backend, no secret, and CORS-open so `fetch`
  works on web. (Nominatim is better known but its policy forbids
  autocomplete-shaped queries.) Pure `parsePhoton` holds every mapping decision
  and is unit-tested; the transport just fetches. Picking a suggestion is what
  sets `lat`/`lng` — a hand-typed venue still logs fine, it just gets no dot, and
  `toConcertRow` omits the columns when unset so inserts work pre-0018.
  `components/concert-map.tsx` is a **stylized SVG poster**, deliberately not a
  tile map (no map SDK, no key, no billing; renders on web + native + the static
  export, reusing `react-native-svg`). All its geometry is pure and tested in
  `map.ts` — equirectangular `projectPoint`, `venuePoints` (fold shows → dots,
  deduped ~100m and sized by count), `viewBoxFor` (auto-fit to the viewer's
  shows), and `unitsPerPixel` (keeps dots a constant *screen* size at any zoom;
  the component measures its width via `onLayout` so the fitted box matches the
  real aspect and SVG can't letterbox it). `world.ts` stores coastlines as
  `[lng,lat]` rings — **not** a pre-baked SVG path — so land projects through the
  same function as the pins and cannot drift out of alignment. **Every ring must
  be simple:** a self-intersecting ring fills its own interior (an early draft
  traced all of Eurasia at once and painted the Mediterranean solid), so Europe /
  Asia / Italy are separate overlapping rings and `world.test.ts` enforces
  simplicity, cities-on-land, and seas-stay-wet.
- `src/comments/` — `CommentsBackend` seam; `SupabaseCommentsBackend` is the
  only implementation (Supabase-backed from day one — see "Supabase" below).
  Users can delete their own comments (trash icon on the item page).
  **Threads** (`0016_comment_threads.sql` — a nullable self-referencing
  `parent_id`, `on delete cascade`): a reply is a comment with `parentId` set;
  the pure, unit-tested `buildThreads` in `filter.ts` folds the flat list into
  top-level comments (scope-filtered + sorted) each carrying their replies
  oldest-first. One level deep — replying to a reply anchors to its root. The
  item page renders replies indented under the parent with a "Reply" affordance
  and a "Replying to X" composer banner.
  **Paging counts ROOTS, not rows** (Phase 4, `0026_comment_paging.sql`):
  `listForItem` fetches 20 top-level comments and then every reply belonging to
  them, in two queries. A flat `limit 20` would hand `buildThreads` replies whose
  parent fell on the next page — and it drops orphans by design (that's exactly
  what makes a blocked user's thread vanish with them), so the comments wouldn't
  be paginated, they'd be *gone*. Two partial indexes serve the two halves.
- `src/moderation/` — **blocking + reporting** (ROADMAP Phase 4), behind a
  `ModerationBackend` seam (`0019_moderation.sql`; Supabase + AsyncStorage,
  `provider.ts`). **These are the app's only private-read tables** — the RLS
  posture elsewhere is "reads are public", but a block list is readable only by
  the blocker and a report only by its reporter (+ a service-role reviewer):
  someone who can tell they've been blocked or reported can retaliate, which is
  the whole thing we're preventing. Reports are immutable (no update/delete
  policy) and unique per `(reporter, target_type, target_id)`, so re-reporting is
  a no-op the UI renders as "already reported".
  **Read side:** pure, unit-tested `filter.ts` (`hideBlockedEvents` /
  `hideBlockedAuthors` / `hideBlockedProfiles`). Applied **in the stores, never
  the screens** — `social/store.tsx` filters `people`+`feed`, `comments/store.ts`
  filters the list, `notifications/store.tsx` filters the list *and* the bell's
  unread count — so a new surface can't forget. `useModerationState` therefore
  mounts **above** `SocialBridge` in `_layout.tsx`; that ordering is load-bearing.
  `hideBlockedEvents` also drops reposts *of* a blocked user (a repost carries
  `payload.originalUserId`), and `comments/filter.ts`'s `buildThreads` drops
  replies whose parent is gone — so a blocked user's thread takes its replies
  with it. Filtering is client-side: rows are still fetched and still public, so
  this is "I don't have to see you", not a privacy boundary.
  **Write side:** 0019 tightens the `follows` / `concert_tags` insert policies so
  a blocked user can't follow or tag you, and adds "remove own follower" so
  `severFollows` can cut the incoming follow (0007 only allowed dropping your
  own). `store.tsx`'s `block()` writes the row then severs both directions.
  UI: `components/action-menu.tsx` (a sheet — this app never uses RN `Alert`,
  which is unreliable on web), the overflow menu on `/user/[id]` + comment cards,
  `src/app/report.tsx`, and `src/app/blocked.tsx` (which reads
  `socialBackend.listProfiles()` *directly*, since `useSocial().people` is
  filtered and this is the one screen meant to show blocked users).
  **Rate limits** (`0021_rate_limits.sql`) are the other half: RLS answers "may
  you write this row?", never "how many this minute?". One generic
  `enforce_rate_limit()` trigger takes the **actor column** as an argument — not a
  hardcoded `user_id` — because follows records the actor in `follower_id` and
  reports in `reporter_id`, so hardcoding would throttle the victim instead of the
  abuser. `concert_tags` needs its own limiter entirely: its `user_id` is the
  person *tagged*, while the tagger is the concert's owner. `AFTER … FOR EACH
  STATEMENT`, not `BEFORE … FOR EACH ROW` — one COUNT per statement instead of per
  row, with visibility guaranteed by definition rather than by how plpgsql happens
  to take snapshots. SECURITY DEFINER is load-bearing: reports are private-read, so
  under the caller's own privileges RLS would filter the COUNT and a limiter that
  reads 0 never fires. `blocks` is deliberately unlimited — mass-blocking a brigade
  is the system working.
  **Admin triage** (`0023_admin_review.sql`, `src/app/admin/reports.tsx`): admins
  are a private `admins` table, not a `profiles.is_admin` flag (profiles is
  public-read — a flag would publish the moderator list to anyone with curl), and
  there is **no API path that grants admin**. `is_admin()` is SECURITY DEFINER to
  break the recursion of a policy on `admins` that must read `admins`. RLS says
  which *rows* an admin may update; a **column grant** (`revoke update … grant
  update (status)`) says which *columns*, so a reviewer can't edit the evidence —
  `reviewed_by`/`reviewed_at` are stamped from the JWT by a trigger. Admins may
  delete comments and feed events (the free-text surfaces), deliberately not
  ratings — removing someone's honest 7/10 isn't moderation. Banning is left to
  the Supabase dashboard rather than an RPC that mutates `auth.users`.
  Pure `admin-rows.ts` (unit-tested) groups reports by target — ten people
  reporting one comment is one decision, and the pile-up is the strongest signal
  in the queue — and reads an unknown status as `open`, so a row can never look
  "already handled" by accident.
  **Renames propagate** (`0022_display_name_propagation.sql`): display names are
  denormalized into `feed_events`/`comments` for one-query feeds, and a repost's
  attribution lives on the *reposter's* row — so propagating your new name means
  writing rows you don't own, which is why the trigger is SECURITY DEFINER. Kept
  denormalized (rather than joining) because renames are rare and feed reads are
  constant, and because PostgREST can only embed through a real FK, which these
  columns can't get while orphaned local-auth-era rows exist.
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
- `src/audio/` — **preview playback** (ROADMAP Phase 2 / F2): `preview.tsx` is a
  single shared `expo-audio` player mounted once in the root layout
  (`PreviewContext`/`usePreview`), so only one 30s clip sounds at a time —
  tapping a new preview replaces the current one. `components/preview-button.tsx`
  is the play/pause affordance (renders nothing without a `previewUrl`), placed
  on search rows, album tracklists, and the item-page header. iTunes'
  `previewUrl` flows via `SearchResult`/`AlbumTrack` (now kept in
  `parseAlbumTracks`) and the item route params. expo-audio works on web +
  native, so no platform branching.
- `src/queue/` — the **want-to-listen queue** (ROADMAP Phase 2 / G1; blueprint
  §2.A): a one-tap bookmark feeding a personal listen-later list, behind a
  `QueueBackend` seam (`0012_queue.sql` — `queue_items`, one row per
  (user,item), denormalized item fields, public-read / owner-write; Supabase +
  AsyncStorage impls, `provider.ts`). Distinct from `ratings` (already ranked)
  and `diary` (dated listens) — this is pre-listen *intent*, so it emits **no
  feed event**. Pure `rows.ts` (unit-tested); optimistic `useQueue()` store
  (`store.tsx`, mounted below playlists) exposes `isQueued`/`toggle`. The
  reusable `components/queue-button.tsx` (icon + labelled-pill variants, auth-
  gated) sits on the item page and search rows; `src/app/queue.tsx` is the list,
  with a "Want to listen" card + count on the Profile.
- `src/browse/` — **browse & discovery** (ROADMAP G2): the non-social surfaces
  both Beli and Letterboxd have, behind a `BrowseBackend` seam (Supabase +
  AsyncStorage, `provider.ts`). The Supabase impl calls the **`browse_items` RPC**
  (`0024_browse_rpc.sql`) — it used to select every rating in the database and
  tally them in the browser, which past PostgREST's row cap would have kept
  *succeeding* while quietly describing an arbitrary subset. Aggregation is now
  server-side; the pure, unit-tested `aggregate.ts` still owns presentation
  (`trending` / `topRated` / `forGenre` / `browseGenres`), and
  `aggregateBrowseItems` still backs the local impl. The RPC returns a **union of
  three top-N picks** (recent / highest-rated / most-rated) because no single
  `ORDER BY` serves both Trending and Top rated — sort by count and a quiet
  four-times-9.5 album never charts; sort by average and this week's release
  never trends. `load({ genres })` scopes server-side so the crawlable
  `/browse/genre/[slug]` pages — the long-tail SEO surface — can't render empty.
  The Browse tab
  (`src/app/(tabs)/browse.tsx`, `/browse`, guest-browsable) renders Trending this
  week + Top rated with genre chips; it carries the Browse AdSlot placement.
- `src/recommendations/` — the **"For you" recommender** (ROADMAP G3), behind a
  thin `RecommendationsBackend` seam (Supabase one-query + AsyncStorage,
  `provider.ts`) that only fetches followed friends' ranked lists. Pure,
  unit-tested `recommend.ts` folds those with `social/compatibility` (per-friend
  taste match) into ranked picks — friends' high ratings (≥8) on items the viewer
  hasn't logged, each attributed to the most-compatible friend who loved it.
  `use-recommendations.ts` fetches once per follow-set and recomputes the picks
  locally against the live `ranked` list; the row renders at the top of the
  Browse tab for signed-in users (empty for guests / no-follows).
- `src/share/` — **share cards** (ROADMAP Phase 3): `export.ts`'s `shareCard`
  rasterizes a rendered card view to PNG with `react-native-view-shot` and hands
  it off — the native share sheet (`expo-sharing`) on device, an `<a download>`
  on web (the myjelli.site acquisition surface). The card itself is the branded,
  fixed-size `components/share-card.tsx` (wordmark + your #1 + headline stats +
  `myjelli.site`), rendered by the `src/app/share-card.tsx` modal (reached from
  the Wrapped screen's share action). Not test-reachable (pulls native modules).
- `src/diary/` — the listen diary (ROADMAP Phase 2; blueprint §1.1): a dated,
  re-loggable entry per active listen, behind a `DiaryBackend` seam
  (`0011_diary.sql` — `diary_entries`, `unique(user,item,logged_at)`, public-read
  / owner-write; Supabase + AsyncStorage impls, `provider.ts`). Kept **separate
  from `ratings`** on purpose: `ratings` stays the one-per-item canonical ranked
  list, while `commitPlacement` (`src/data/store.ts`) also writes a diary entry
  on every log (additive, alongside the feed event + streak hook). Pure `rows.ts`
  (`groupByDay`, unit-tested) drives the day-grouped timeline in
  `src/app/diary.tsx`, reached from a "Your diary" card on the Profile.
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
- `npm run test:migrations` — **replay every migration into a throwaway Postgres
  container** (needs Docker). `supabase/test/bootstrap.sql` stands in for the
  parts of a Supabase project the migrations don't create (the `auth` schema and
  a real `auth.uid()` reading `request.jwt.claims`, `storage.objects`, the
  anon/authenticated roles and their default grants). Every migration from 0021
  on ends in a `do $$ … $$` **self-test** that asserts its own behavior and
  raises if wrong — several run `set local role authenticated` so they exercise
  RLS for real, since the table owner bypasses it and a policy test as `postgres`
  asserts nothing. `KEEP=1` leaves the container up to poke at.
  **It runs twice.** Pass 1 is a clean database; pass 2 seeds
  `supabase/test/seed.sql` and re-runs the self-testing migrations against it.
  Pass 2 exists because pass 1 alone is a lie: a self-test runs against
  *production*, so any assertion not scoped to rows it created itself ("the
  top-rated album is mine", "one profile matches %MAYA%") passes on an empty
  container and fails on the real project. That happened to 0024, and 0025 was
  next. **The rule: a self-test must assert only about rows it made, using values
  nothing real could collide with** — the seed deliberately plants a `Probe Rock`
  item and a profile called `Maya` to punish guessable probe names.
  A pass means the SQL is valid and its logic holds against a Supabase-shaped
  schema, populated or not — not that production is fine.

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
  unless web + client id + a per-placement slot id are all set (two placements
  ship: `EXPO_PUBLIC_ADSENSE_SLOT_FEED` at the bottom of the Feed tab and
  `EXPO_PUBLIC_ADSENSE_SLOT_BROWSE` at the bottom of the Browse tab — the
  content-rich discovery page). Keep ads out of the Rate flow and Ranks — core
  interactions stay clean.
- `public/ads.txt` is a commented placeholder until AdSense approval; fill in
  the real `google.com, pub-…` line then. Native ads would be AdMob — a
  separate integration, deliberately not wired.

## Migrations are applied by hand — check, don't assume
`npm run check:live` probes the **live** project through PostgREST and reports
which migrations actually landed. `npm run test:migrations` proves the SQL is
*correct*; only this tells you whether production *has* it, and those are
different questions. Because migrations are run manually, the deployed bundle and
the live schema drift silently.

**That drift has bitten twice.** `0015` (avatars bucket) and `0016`
(comments.parent_id) were written, shipped and never run — so avatar upload
returned "Bucket not found" and, the moment Phase 4's comment paging referenced
`parent_id`, comments stopped loading on every item page.

The rule this earned: **a deploy must never require a migration to have run
first.** Backends `select *` and omit new columns when unset (`toConcertRow` since
0018), and where a query can't avoid naming a new column, catch Postgres `42703`
and fall back to the pre-migration shape (`SupabaseCommentsBackend
.listForItemPre0016`). Run `check:live` before assuming a feature is live.

### The avatar is deleted by the client, not by `delete_own_account()`
Supabase guards its storage tables with a **statement-level** `storage.protect_delete()`
trigger that rejects direct DML (*"Use the Storage API instead"*). From 0020 until
Phase 4, `delete_own_account()` ended with a `delete from storage.objects` — so it
threw `42501` and **the Delete Account button never worked once**. Nothing caught
it: the RPC existed and correctly rejected anon, which is what got checked; that
proves a function exists, not that it runs.

So `SupabaseAuthBackend.removeAvatar` deletes the file through the Storage API
**before** calling the RPC — the bucket's RLS is owner-scoped (0015), so
authorization dies with the account and doing it after would orphan the photo
publicly forever. "Nothing to delete" counts as success (no avatar, or 0015 never
run); anything else throws so the caller retries with the account intact.

`supabase/test/bootstrap.sql` now mirrors that trigger — **statement-level, which
is load-bearing**: a row-level copy only fires when the DELETE matches something,
so a probe user with no avatar sails through and the harness certifies the bug
again. A stand-in that is more permissive than production doesn't just miss bugs,
it vouches for them.
