-- Heard — RESET + full setup. Safe to run on a partially-set-up or fresh project.
-- WARNING: drops all Heard tables (and their data) first, then recreates them.
-- Fine now (brand-new project). Do NOT run this once the DB holds real data.

-- ============================================================
-- Drop existing objects (CASCADE clears FKs, policies, indexes)
-- ============================================================
drop table if exists public.comments cascade;
drop table if exists public.likes cascade;
drop table if exists public.ratings cascade;
drop table if exists public.comparisons cascade;
drop table if exists public.items cascade;
drop table if exists public.profiles cascade;
drop table if exists public.follows cascade;
drop table if exists public.feed_events cascade;
drop table if exists public.concerts cascade;
drop table if exists public.concert_tags cascade;


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

