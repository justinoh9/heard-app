-- ============================================================================
-- Heard — full database setup (migrations 0001–0006 combined).
--
-- Paste this whole file into the Supabase SQL Editor and Run, ONCE, on a fresh
-- project. It creates every table the app uses (comments, likes, items,
-- ratings, comparisons, profiles, follows, feed_events, concerts,
-- concert_tags) with the same public-read / trust-client-write RLS the
-- individual migration files ship (see each 000N_*.sql for rationale).
--
-- Safe to re-run: each object is guarded with IF NOT EXISTS / drop-and-recreate
-- so running it a second time won't error on already-created tables/policies.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 0001 — comments
-- ---------------------------------------------------------------------------
create table if not exists public.comments (
  id           uuid primary key default gen_random_uuid(),
  item_id      text not null,
  item_type    text not null check (item_type in ('song', 'album')),
  item_title   text not null,
  item_artist  text not null,
  item_art_url text,
  user_id      text not null,
  display_name text not null,
  body         text not null check (char_length(trim(body)) > 0 and char_length(body) <= 1000),
  created_at   timestamptz not null default now()
);
create index if not exists comments_item_idx on public.comments (item_type, item_id, created_at desc);
alter table public.comments enable row level security;

drop policy if exists "comments are publicly readable" on public.comments;
create policy "comments are publicly readable" on public.comments for select using (true);
drop policy if exists "anyone can insert a comment" on public.comments;
create policy "anyone can insert a comment" on public.comments for insert
  with check (
    char_length(trim(body)) > 0 and char_length(body) <= 1000 and item_type in ('song', 'album')
  );

-- ---------------------------------------------------------------------------
-- 0002 — likes
-- ---------------------------------------------------------------------------
create table if not exists public.likes (
  id          uuid primary key default gen_random_uuid(),
  target_type text not null check (target_type in ('item', 'comment')),
  target_id   text not null,
  user_id     text not null,
  created_at  timestamptz not null default now(),
  unique (target_type, target_id, user_id)
);
create index if not exists likes_target_idx on public.likes (target_type, target_id);
alter table public.likes enable row level security;

drop policy if exists "likes are publicly readable" on public.likes;
create policy "likes are publicly readable" on public.likes for select using (true);
drop policy if exists "anyone can insert a like" on public.likes;
create policy "anyone can insert a like" on public.likes for insert
  with check (target_type in ('item', 'comment'));
drop policy if exists "anyone can delete a like" on public.likes;
create policy "anyone can delete a like" on public.likes for delete using (true);

-- ---------------------------------------------------------------------------
-- 0003 — items / ratings / comparisons
-- ---------------------------------------------------------------------------
create table if not exists public.items (
  id             text primary key,
  type           text not null check (type in ('song', 'album', 'artist')),
  title          text not null,
  artist         text not null,
  art_url        text,
  release_year   int,
  genres         text[],
  parent_item_id text references public.items (id),
  spotify_uri    text,
  popularity     int,
  updated_at     timestamptz not null default now()
);

create table if not exists public.ratings (
  id         uuid primary key default gen_random_uuid(),
  user_id    text not null,
  item_id    text not null references public.items (id),
  score      numeric(3, 1) not null check (score >= 0 and score <= 10),
  tiebreak   int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, item_id)
);
create index if not exists ratings_user_idx on public.ratings (user_id);
create index if not exists ratings_item_idx on public.ratings (item_id);

create table if not exists public.comparisons (
  id          uuid primary key default gen_random_uuid(),
  user_id     text not null,
  winner_id   text not null references public.items (id),
  loser_id    text not null references public.items (id),
  compared_at timestamptz not null,
  created_at  timestamptz not null default now()
);
create index if not exists comparisons_user_idx on public.comparisons (user_id);

alter table public.items enable row level security;
alter table public.ratings enable row level security;
alter table public.comparisons enable row level security;

drop policy if exists "items are publicly readable" on public.items;
create policy "items are publicly readable" on public.items for select using (true);
drop policy if exists "anyone can cache an item" on public.items;
create policy "anyone can cache an item" on public.items for insert with check (true);
drop policy if exists "anyone can refresh a cached item" on public.items;
create policy "anyone can refresh a cached item" on public.items for update using (true);

drop policy if exists "ratings are publicly readable" on public.ratings;
create policy "ratings are publicly readable" on public.ratings for select using (true);
drop policy if exists "anyone can insert a rating" on public.ratings;
create policy "anyone can insert a rating" on public.ratings for insert with check (true);
drop policy if exists "anyone can update a rating" on public.ratings;
create policy "anyone can update a rating" on public.ratings for update using (true);

drop policy if exists "comparisons are publicly readable" on public.comparisons;
create policy "comparisons are publicly readable" on public.comparisons for select using (true);
drop policy if exists "anyone can insert a comparison" on public.comparisons;
create policy "anyone can insert a comparison" on public.comparisons for insert with check (true);

-- ---------------------------------------------------------------------------
-- 0004 — profiles / follows / feed_events  (+ 0005 favorites column)
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  user_id      text primary key,
  display_name text not null,
  favorites    text[] not null default '{}',   -- 0005
  updated_at   timestamptz not null default now()
);
-- If profiles already existed without the 0005 column, add it.
alter table public.profiles add column if not exists favorites text[] not null default '{}';

create table if not exists public.follows (
  follower_id text not null,
  followee_id text not null,
  created_at  timestamptz not null default now(),
  primary key (follower_id, followee_id),
  check (follower_id <> followee_id)
);
create index if not exists follows_followee_idx on public.follows (followee_id);

create table if not exists public.feed_events (
  id           uuid primary key default gen_random_uuid(),
  user_id      text not null,
  display_name text not null,
  type         text not null check (type in ('rated', 'drop', 'streak', 'concert', 'list')),  -- 'concert' 0006, 'list' 0007
  payload      jsonb not null default '{}',
  created_at   timestamptz not null default now()
);
create index if not exists feed_events_user_idx on public.feed_events (user_id, created_at desc);

alter table public.profiles enable row level security;
alter table public.follows enable row level security;
alter table public.feed_events enable row level security;

drop policy if exists "profiles are publicly readable" on public.profiles;
create policy "profiles are publicly readable" on public.profiles for select using (true);
drop policy if exists "anyone can create a profile" on public.profiles;
create policy "anyone can create a profile" on public.profiles for insert with check (true);
drop policy if exists "anyone can update a profile" on public.profiles;
create policy "anyone can update a profile" on public.profiles for update using (true);

drop policy if exists "follows are publicly readable" on public.follows;
create policy "follows are publicly readable" on public.follows for select using (true);
drop policy if exists "anyone can follow" on public.follows;
create policy "anyone can follow" on public.follows for insert with check (true);
drop policy if exists "anyone can unfollow" on public.follows;
create policy "anyone can unfollow" on public.follows for delete using (true);

drop policy if exists "feed events are publicly readable" on public.feed_events;
create policy "feed events are publicly readable" on public.feed_events for select using (true);
drop policy if exists "anyone can publish a feed event" on public.feed_events;
create policy "anyone can publish a feed event" on public.feed_events for insert with check (true);

-- ---------------------------------------------------------------------------
-- 0006 — concerts / concert_tags
-- ---------------------------------------------------------------------------
create table if not exists public.concerts (
  id          uuid primary key default gen_random_uuid(),
  user_id     text not null,
  artist_name text not null,
  artist_id   text,
  venue       text,
  city        text,
  show_date   date not null,
  score       numeric(3, 1) check (score >= 0 and score <= 10),
  notes       text,
  created_at  timestamptz not null default now()
);
create index if not exists concerts_user_idx on public.concerts (user_id, show_date desc);

create table if not exists public.concert_tags (
  concert_id uuid not null references public.concerts (id) on delete cascade,
  user_id    text not null,
  primary key (concert_id, user_id)
);
create index if not exists concert_tags_user_idx on public.concert_tags (user_id);

alter table public.concerts enable row level security;
alter table public.concert_tags enable row level security;

drop policy if exists "concerts are publicly readable" on public.concerts;
create policy "concerts are publicly readable" on public.concerts for select using (true);
drop policy if exists "anyone can log a concert" on public.concerts;
create policy "anyone can log a concert" on public.concerts for insert with check (true);

drop policy if exists "concert tags are publicly readable" on public.concert_tags;
create policy "concert tags are publicly readable" on public.concert_tags for select using (true);
drop policy if exists "anyone can tag attendees" on public.concert_tags;
create policy "anyone can tag attendees" on public.concert_tags for insert with check (true);

-- ---------------------------------------------------------------------------
-- 0007 — lists / list_items
-- ---------------------------------------------------------------------------
create table if not exists public.lists (
  id         uuid primary key default gen_random_uuid(),
  user_id    text not null,
  name       text not null check (char_length(trim(name)) > 0 and char_length(name) <= 60),
  created_at timestamptz not null default now()
);
create index if not exists lists_user_idx on public.lists (user_id, created_at desc);

create table if not exists public.list_items (
  list_id  uuid not null references public.lists (id) on delete cascade,
  item_id  text not null,
  title    text not null,
  artist   text not null,
  art_url  text,
  kind     text not null check (kind in ('song', 'album', 'artist')),
  position int not null default 0,
  primary key (list_id, item_id)
);
create index if not exists list_items_list_idx on public.list_items (list_id, position);

-- feed_events already exists above, so its inline check never re-ran; refresh it
-- to include 'list' (idempotent).
alter table public.feed_events drop constraint if exists feed_events_type_check;
alter table public.feed_events
  add constraint feed_events_type_check
  check (type in ('rated', 'drop', 'streak', 'concert', 'list'));

alter table public.lists enable row level security;
alter table public.list_items enable row level security;

drop policy if exists "lists are publicly readable" on public.lists;
create policy "lists are publicly readable" on public.lists for select using (true);
drop policy if exists "anyone can create a list" on public.lists;
create policy "anyone can create a list" on public.lists for insert with check (true);
drop policy if exists "anyone can delete a list" on public.lists;
create policy "anyone can delete a list" on public.lists for delete using (true);

drop policy if exists "list items are publicly readable" on public.list_items;
create policy "list items are publicly readable" on public.list_items for select using (true);
drop policy if exists "anyone can add a list item" on public.list_items;
create policy "anyone can add a list item" on public.list_items for insert with check (true);
drop policy if exists "anyone can update a list item" on public.list_items;
create policy "anyone can update a list item" on public.list_items for update using (true);
drop policy if exists "anyone can remove a list item" on public.list_items;
create policy "anyone can remove a list item" on public.list_items for delete using (true);
