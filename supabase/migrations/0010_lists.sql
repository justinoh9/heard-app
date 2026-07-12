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
