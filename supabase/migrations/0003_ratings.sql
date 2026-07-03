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
