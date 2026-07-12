-- Heard — full database setup (generated from supabase/migrations/0001–0010).
-- Paste this whole file into the Supabase SQL Editor of a FRESH project and Run.
-- Order matters: tables reference each other. Do not re-run on a DB that already has these tables.
--
-- NOTE: sections 0001–0006 create the original permissive ("trust the client")
-- policies and their comments describe that era; the 0007/0008 sections at the
-- END of this file then replace them with the hardened auth.uid()-scoped
-- policies. The final state requires Supabase Auth to be enabled (it is the
-- app's auth backend whenever the env vars are set).


-- ============================================================
-- 0001_comments.sql
-- ============================================================
-- Public comments on songs/albums. Denormalized item fields on each row —
-- no separate "items" table, since nothing today needs item-level
-- aggregation independent of comments (ratings stay local/in-memory).

create table public.comments (
  id           uuid primary key default gen_random_uuid(),
  item_id      text not null,
  item_type    text not null check (item_type in ('song', 'album')),
  item_title   text not null,
  item_artist  text not null,
  item_art_url text,
  user_id      text not null,        -- LocalAuthBackend user.id, NOT a Supabase auth uid
  display_name text not null,        -- snapshot at post time; doesn't update if the user renames later
  body         text not null check (char_length(trim(body)) > 0 and char_length(body) <= 1000),
  created_at   timestamptz not null default now()
);

create index comments_item_idx on public.comments (item_type, item_id, created_at desc);

alter table public.comments enable row level security;

create policy "comments are publicly readable"
  on public.comments for select
  using (true);

-- Public insert trusts the client-supplied user_id/display_name. There is no
-- Supabase Auth session to verify against here — auth stays on this app's
-- LocalAuthBackend, so RLS cannot cryptographically confirm who's posting.
-- This is the same trust level as the rest of this prototype today. Revisit
-- if/when auth migrates to Supabase Auth (then: with check (auth.uid()::text = user_id)).
create policy "anyone can insert a comment"
  on public.comments for insert
  with check (
    char_length(trim(body)) > 0
    and char_length(body) <= 1000
    and item_type in ('song', 'album')
  );

-- No update/delete policy: both are denied by default (RLS fails closed).


-- ============================================================
-- 0002_likes.sql
-- ============================================================
-- Likes on songs/albums (item profile) and on comments. One generic table,
-- discriminated by target_type, instead of two near-identical tables — a like
-- is the same concept either way (this user, this thing, one row).

create table public.likes (
  id          uuid primary key default gen_random_uuid(),
  target_type text not null check (target_type in ('item', 'comment')),
  target_id   text not null,        -- item id (MusicBrainz mbid) or comments.id (uuid-as-text)
  user_id     text not null,        -- LocalAuthBackend user.id, NOT a Supabase auth uid
  created_at  timestamptz not null default now(),
  unique (target_type, target_id, user_id)
);

create index likes_target_idx on public.likes (target_type, target_id);

alter table public.likes enable row level security;

create policy "likes are publicly readable"
  on public.likes for select
  using (true);

-- As with comments (0001_comments.sql): there is no Supabase Auth session to
-- verify against, so RLS cannot cryptographically confirm who's liking or
-- unliking what. Insert/delete trust the client-supplied user_id — the same
-- trust level as the rest of this prototype. Revisit if/when auth migrates to
-- Supabase Auth (then: with check (auth.uid()::text = user_id) / using (...)).
create policy "anyone can insert a like"
  on public.likes for insert
  with check (target_type in ('item', 'comment'));

create policy "anyone can delete a like"
  on public.likes for delete
  using (true);

-- No update policy: likes are add/remove only, denied by default (RLS fails closed).


-- ============================================================
-- 0003_ratings.sql
-- ============================================================
-- Ratings persistence (PRODUCT_BLUEPRINT §3.2, build order item 2): moves the
-- user's ranked list and the banked comparison log off in-memory state.
--
-- Three tables, per the blueprint:
--   items       — shared catalog cache (song/album/artist metadata), keyed by
--                 provider id, so ratings/feeds join instead of re-fetching
--                 Spotify. Columns the client doesn't populate yet
--                 (release_year, genres, …) exist now to avoid ALTERs later.
--   ratings     — one row per (user, item): headline score + hidden tiebreak
--                 (SPEC §6). The ranked list IS this table sorted by
--                 score desc, tiebreak desc.
--   comparisons — the banked head-to-head log (SPEC §5). Append-only; replay
--                 enables a future Elo engine without re-asking users.

create table public.items (
  id             text primary key,                -- provider id (Spotify, or MusicBrainz for seed data)
  type           text not null check (type in ('song', 'album', 'artist')),
  title          text not null,
  artist         text not null,
  art_url        text,
  release_year   int,
  genres         text[],
  parent_item_id text references public.items (id), -- track -> album, future
  spotify_uri    text,
  popularity     int,
  updated_at     timestamptz not null default now()
);

create table public.ratings (
  id         uuid primary key default gen_random_uuid(),
  user_id    text not null,                        -- LocalAuthBackend user.id, NOT a Supabase auth uid
  item_id    text not null references public.items (id),
  score      numeric(3, 1) not null check (score >= 0 and score <= 10),
  tiebreak   int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, item_id)
);

create index ratings_user_idx on public.ratings (user_id);
-- For the future feed/compatibility queries ("who rated this item").
create index ratings_item_idx on public.ratings (item_id);

create table public.comparisons (
  id          uuid primary key default gen_random_uuid(),
  user_id     text not null,
  winner_id   text not null references public.items (id),
  loser_id    text not null references public.items (id),
  compared_at timestamptz not null,                -- the client's event timestamp
  created_at  timestamptz not null default now()
);

create index comparisons_user_idx on public.comparisons (user_id);

alter table public.items enable row level security;
alter table public.ratings enable row level security;
alter table public.comparisons enable row level security;

-- As with comments/likes (0001/0002): no Supabase Auth session exists, so RLS
-- cannot verify the actor. Reads are public (ratings feed the social surface);
-- writes trust the client-supplied user_id — the prototype's trust level.
-- Revisit when auth migrates to Supabase Auth (blueprint §3.4):
-- with check (auth.uid()::text = user_id).

create policy "items are publicly readable"
  on public.items for select using (true);
create policy "anyone can cache an item"
  on public.items for insert with check (true);
create policy "anyone can refresh a cached item"
  on public.items for update using (true);

create policy "ratings are publicly readable"
  on public.ratings for select using (true);
create policy "anyone can insert a rating"
  on public.ratings for insert with check (true);
create policy "anyone can update a rating"
  on public.ratings for update using (true);
-- No delete policy yet: there's no un-rate flow, so it fails closed.

create policy "comparisons are publicly readable"
  on public.comparisons for select using (true);
create policy "anyone can insert a comparison"
  on public.comparisons for insert with check (true);
-- Append-only: no update/delete policies — the banked log must not be rewritten.


-- ============================================================
-- 0004_social.sql
-- ============================================================
-- Social spine (PRODUCT_BLUEPRINT §2.C, build order item 4): the follow graph
-- and the activity feed that every meaningful action writes into.
--
--   profiles    — a public directory of users (LocalAuthBackend ids), upserted
--                 at sign-in so people can find and follow each other. Becomes
--                 redundant when auth migrates to Supabase Auth (§3.4).
--   follows     — who follows whom. The feed is "events by people I follow".
--   feed_events — append-only activity log (blueprint §3.2). `payload` is
--                 type-specific JSON (item, score, caption, …) so new event
--                 types don't need migrations.

create table public.profiles (
  user_id      text primary key,              -- LocalAuthBackend user.id
  display_name text not null,
  updated_at   timestamptz not null default now()
);

create table public.follows (
  follower_id text not null,
  followee_id text not null,
  created_at  timestamptz not null default now(),
  primary key (follower_id, followee_id),
  check (follower_id <> followee_id)
);

create index follows_followee_idx on public.follows (followee_id);

create table public.feed_events (
  id           uuid primary key default gen_random_uuid(),
  user_id      text not null,
  display_name text not null,                 -- denormalized for one-query feeds
  type         text not null check (type in ('rated', 'drop', 'streak')),
  payload      jsonb not null default '{}',
  created_at   timestamptz not null default now()
);

create index feed_events_user_idx on public.feed_events (user_id, created_at desc);

alter table public.profiles enable row level security;
alter table public.follows enable row level security;
alter table public.feed_events enable row level security;

-- Same trust posture as 0001–0003: no Supabase Auth session exists, so writes
-- trust the client-supplied ids. Revisit with auth (blueprint §3.4).

create policy "profiles are publicly readable"
  on public.profiles for select using (true);
create policy "anyone can create a profile"
  on public.profiles for insert with check (true);
create policy "anyone can update a profile"
  on public.profiles for update using (true);

create policy "follows are publicly readable"
  on public.follows for select using (true);
create policy "anyone can follow"
  on public.follows for insert with check (true);
create policy "anyone can unfollow"
  on public.follows for delete using (true);

create policy "feed events are publicly readable"
  on public.feed_events for select using (true);
create policy "anyone can publish a feed event"
  on public.feed_events for insert with check (true);
-- Append-only: no update/delete — the activity log is history, not state.


-- ============================================================
-- 0005_favorites.sql
-- ============================================================
-- Top 4 favorites (PRODUCT_BLUEPRINT §2.D, the Letterboxd "4 favorites" pull):
-- the user's four defining albums, pinned to their profile. Stored on the
-- profiles row as ordered item ids; art resolves against the items table /
-- the owner's ranked list client-side.

alter table public.profiles
  add column favorites text[] not null default '{}';


-- ============================================================
-- 0006_concerts.sql
-- ============================================================
-- Live concert logging (PRODUCT_BLUEPRINT §2.C + Key Features: the "map"
-- mechanic). Users log shows — artist, venue, date, a performance score —
-- and tag the friends they went with; the show lands on every attendee's
-- profile and in the activity feed.

create table public.concerts (
  id          uuid primary key default gen_random_uuid(),
  user_id     text not null,                 -- the logger (LocalAuthBackend id)
  artist_name text not null,
  artist_id   text,                          -- optional Spotify artist id
  venue       text,
  city        text,
  show_date   date not null,
  score       numeric(3, 1) check (score >= 0 and score <= 10),
  notes       text,
  created_at  timestamptz not null default now()
);

create index concerts_user_idx on public.concerts (user_id, show_date desc);

-- Friends tagged at a show. Prototype trust level: tags apply immediately
-- (no pending/confirm handshake yet — blueprint marks that as a follow-up).
create table public.concert_tags (
  concert_id uuid not null references public.concerts (id) on delete cascade,
  user_id    text not null,
  primary key (concert_id, user_id)
);

create index concert_tags_user_idx on public.concert_tags (user_id);

-- Feed events grow a 'concert' type.
alter table public.feed_events drop constraint feed_events_type_check;
alter table public.feed_events
  add constraint feed_events_type_check
  check (type in ('rated', 'drop', 'streak', 'concert'));

alter table public.concerts enable row level security;
alter table public.concert_tags enable row level security;

-- Same trust posture as 0001–0005 until Supabase Auth lands (blueprint §3.4).
create policy "concerts are publicly readable"
  on public.concerts for select using (true);
create policy "anyone can log a concert"
  on public.concerts for insert with check (true);

create policy "concert tags are publicly readable"
  on public.concert_tags for select using (true);
create policy "anyone can tag attendees"
  on public.concert_tags for insert with check (true);
-- No update/delete yet: shows are append-only until an edit flow exists.



-- ============================================================
-- 0007_rls_harden.sql
-- ============================================================
-- Harden RLS now that Supabase Auth is live (blueprint §3.4). Before this,
-- every table trusted a client-supplied user_id (prototype posture). With real
-- auth, `auth.uid()` identifies the caller, so writes must be by the owner.
--
-- Reads stay PUBLIC — the app shows others' ratings, comments, profiles, and
-- activity, and guests browse them. Only writes tighten.
--
-- Safe because the app sends user_id = the Supabase auth uid (SupabaseAuthBackend
-- sets user.id to auth.uid()), so legitimate writes satisfy auth.uid()::text =
-- user_id. Existing rows (seed / pre-auth) are untouched — RLS governs new
-- writes only. Run AFTER 0001–0006 (or setup.sql) on a project with Supabase
-- Auth enabled.

-- ---- comments: insert only as yourself ----
drop policy if exists "anyone can insert a comment" on public.comments;
create policy "insert own comment" on public.comments for insert
  with check (
    auth.uid()::text = user_id
    and char_length(trim(body)) > 0
    and char_length(body) <= 1000
    and item_type in ('song', 'album')
  );

-- ---- likes: insert/delete only your own ----
drop policy if exists "anyone can insert a like" on public.likes;
create policy "insert own like" on public.likes for insert
  with check (auth.uid()::text = user_id and target_type in ('item', 'comment'));
drop policy if exists "anyone can delete a like" on public.likes;
create policy "delete own like" on public.likes for delete
  using (auth.uid()::text = user_id);

-- ---- items: shared catalog cache — any signed-in user may cache/refresh ----
drop policy if exists "anyone can cache an item" on public.items;
create policy "authed can cache an item" on public.items for insert
  with check (auth.uid() is not null);
drop policy if exists "anyone can refresh a cached item" on public.items;
create policy "authed can refresh an item" on public.items for update
  using (auth.uid() is not null);

-- ---- ratings: insert/update only your own ----
drop policy if exists "anyone can insert a rating" on public.ratings;
create policy "insert own rating" on public.ratings for insert
  with check (auth.uid()::text = user_id);
drop policy if exists "anyone can update a rating" on public.ratings;
create policy "update own rating" on public.ratings for update
  using (auth.uid()::text = user_id);

-- ---- comparisons: append only your own ----
drop policy if exists "anyone can insert a comparison" on public.comparisons;
create policy "insert own comparison" on public.comparisons for insert
  with check (auth.uid()::text = user_id);

-- ---- profiles: create/update only your own ----
drop policy if exists "anyone can create a profile" on public.profiles;
create policy "create own profile" on public.profiles for insert
  with check (auth.uid()::text = user_id);
drop policy if exists "anyone can update a profile" on public.profiles;
create policy "update own profile" on public.profiles for update
  using (auth.uid()::text = user_id);

-- ---- follows: follow/unfollow only as yourself ----
drop policy if exists "anyone can follow" on public.follows;
create policy "follow as self" on public.follows for insert
  with check (auth.uid()::text = follower_id);
drop policy if exists "anyone can unfollow" on public.follows;
create policy "unfollow as self" on public.follows for delete
  using (auth.uid()::text = follower_id);

-- ---- feed_events: publish only your own ----
drop policy if exists "anyone can publish a feed event" on public.feed_events;
create policy "publish own feed event" on public.feed_events for insert
  with check (auth.uid()::text = user_id);

-- ---- concerts: log only your own ----
drop policy if exists "anyone can log a concert" on public.concerts;
create policy "log own concert" on public.concerts for insert
  with check (auth.uid()::text = user_id);

-- ---- concert_tags: only the concert's owner may tag attendees ----
drop policy if exists "anyone can tag attendees" on public.concert_tags;
create policy "owner tags attendees" on public.concert_tags for insert
  with check (auth.uid()::text = (select user_id from public.concerts where id = concert_id));


-- ============================================================
-- 0008_owner_delete.sql
-- ============================================================
-- Owner deletes + items cache lockdown (Phase 0, ROADMAP R4 + R7).
--
-- R4: 0007 hardened writes to the owner but left no DELETE policies at all, so
-- users could never remove their own content. Every delete below is scoped to
-- auth.uid(), matching 0007's write posture. Reads stay public.
--
-- R7: 0007's items UPDATE policy let ANY signed-in user rewrite any cached
-- item's title/art for everyone (shared-cache vandalism). The cache is now
-- insert-only — the client upserts with ignoreDuplicates (ON CONFLICT DO
-- NOTHING), so no update path is needed. Metadata refresh becomes a future
-- server-side enrichment job (blueprint §2.A).
--
-- Run AFTER 0007.

-- ---- comments: delete your own ----
create policy "delete own comment" on public.comments for delete
  using (auth.uid()::text = user_id);

-- ---- ratings: delete your own ----
create policy "delete own rating" on public.ratings for delete
  using (auth.uid()::text = user_id);

-- ---- comparisons: delete your own (the app keeps the bank; this is for
-- user-initiated data removal) ----
create policy "delete own comparison" on public.comparisons for delete
  using (auth.uid()::text = user_id);

-- ---- concerts: delete your own (tags cascade via FK) ----
create policy "delete own concert" on public.concerts for delete
  using (auth.uid()::text = user_id);

-- ---- concert_tags: untag yourself, or the concert's owner removes any tag ----
create policy "untag self or own concert" on public.concert_tags for delete
  using (
    auth.uid()::text = user_id
    or auth.uid()::text = (select user_id from public.concerts where id = concert_id)
  );

-- ---- feed_events: delete your own ----
create policy "delete own feed event" on public.feed_events for delete
  using (auth.uid()::text = user_id);

-- ---- items: drop the update path entirely (insert-only shared cache) ----
drop policy if exists "authed can refresh an item" on public.items;
drop policy if exists "anyone can refresh a cached item" on public.items;


-- =====================================================================
-- 0009_drops.sql — Daily Drop persistence (appended)
-- =====================================================================
-- Daily Drop persistence (ROADMAP Phase 1, R11). The "audio-BeReal" card at the
-- top of the feed — what a user is listening to right now — was in-memory and
-- vanished on reload. This table makes it durable with a real 24h lifetime.
--
-- One active drop per user (unique user_id, upserted on re-post — the "replace
-- drop" action), denormalized item metadata like feed_events.payload so no join
-- is needed to render the card. Visibility (24h) is enforced client-side off
-- created_at; the row is overwritten, not accumulated, so the table stays one
-- row per user. Written for the hardened RLS posture (Supabase Auth live).
-- Run AFTER 0008 (or setup.sql).

create table public.drops (
  user_id     text primary key,              -- one active drop per user (auth uid)
  item_id     text not null,
  item_type   text not null check (item_type in ('song', 'album')),
  item_title  text not null,
  item_artist text not null,
  item_art_url text,
  caption     text check (caption is null or char_length(caption) <= 280),
  created_at  timestamptz not null default now()
);

alter table public.drops enable row level security;

-- Reads public (the feed shows friends' drops); writes/deletes owner-scoped.
create policy "drops are publicly readable"
  on public.drops for select using (true);
create policy "post own drop" on public.drops for insert
  with check (auth.uid()::text = user_id);
create policy "replace own drop" on public.drops for update
  using (auth.uid()::text = user_id);
create policy "clear own drop" on public.drops for delete
  using (auth.uid()::text = user_id);


-- =====================================================================
-- 0010_lists.sql — Lists persistence (appended)
-- =====================================================================
-- Lists persistence (ROADMAP Phase 1, R12; PRODUCT_BLUEPRINT §3.2). Playlists
-- were seeded in-memory and vanished on reload. These tables make them durable
-- and shareable (Letterboxd's virality engine). The client module stays named
-- "playlists" (src/playlists) and maps onto these `lists`/`list_items` tables.
--
-- Reads are public so a list can be shared; writes are owner-scoped. Ordering
-- is carried by list_items.position so a curated order survives a round-trip.
-- Written for the hardened RLS posture (Supabase Auth live). Run AFTER 0009.

create table public.lists (
  id         uuid primary key default gen_random_uuid(),
  user_id    text not null,                 -- the owner (auth uid)
  name       text not null check (char_length(trim(name)) > 0 and char_length(name) <= 120),
  created_at timestamptz not null default now()
);

create index lists_user_idx on public.lists (user_id, created_at desc);

create table public.list_items (
  list_id    uuid not null references public.lists (id) on delete cascade,
  song_id    text not null,                 -- catalog/search id (song or album)
  title      text not null,
  artist     text not null,
  art_url    text,
  kind       text not null check (kind in ('song', 'album')),
  position   int not null default 0,        -- curated order within the list
  created_at timestamptz not null default now(),
  primary key (list_id, song_id)
);

create index list_items_list_idx on public.list_items (list_id, position);

-- Feed events grow a 'made_list' type (a list creation rides the feed).
alter table public.feed_events drop constraint feed_events_type_check;
alter table public.feed_events
  add constraint feed_events_type_check
  check (type in ('rated', 'drop', 'streak', 'concert', 'made_list'));

alter table public.lists enable row level security;
alter table public.list_items enable row level security;

-- lists: public read, owner-scoped write/update/delete.
create policy "lists are publicly readable"
  on public.lists for select using (true);
create policy "create own list" on public.lists for insert
  with check (auth.uid()::text = user_id);
create policy "update own list" on public.lists for update
  using (auth.uid()::text = user_id);
create policy "delete own list" on public.lists for delete
  using (auth.uid()::text = user_id);

-- list_items: public read; writes only by the parent list's owner.
create policy "list items are publicly readable"
  on public.list_items for select using (true);
create policy "add items to own list" on public.list_items for insert
  with check (auth.uid()::text = (select user_id from public.lists where id = list_id));
create policy "update items in own list" on public.list_items for update
  using (auth.uid()::text = (select user_id from public.lists where id = list_id));
create policy "remove items from own list" on public.list_items for delete
  using (auth.uid()::text = (select user_id from public.lists where id = list_id));
