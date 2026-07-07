-- Custom lists (PRODUCT_BLUEPRINT §1.1 + §2.C): the Letterboxd growth loop
-- retargeted at music — user-curated, shareable collections ("Late night",
-- "Best rap of 2020"). Creating one publishes a 'list' feed event.

create table public.lists (
  id         uuid primary key default gen_random_uuid(),
  user_id    text not null,                 -- owner (LocalAuthBackend id)
  name       text not null check (char_length(trim(name)) > 0 and char_length(name) <= 60),
  created_at timestamptz not null default now()
);

create index lists_user_idx on public.lists (user_id, created_at desc);

-- Songs in a list. The display fields (title/artist/art_url/kind) are
-- denormalized here rather than FK-ing into `items`, so adding a search result
-- is a single insert with no prior catalog cache — matches how the client's
-- PlaylistSong already carries its own display data.
create table public.list_items (
  list_id  uuid not null references public.lists (id) on delete cascade,
  item_id  text not null,
  title    text not null,
  artist   text not null,
  art_url  text,
  kind     text not null check (kind in ('song', 'album', 'artist')),
  position int not null default 0,
  primary key (list_id, item_id)
);

create index list_items_list_idx on public.list_items (list_id, position);

-- Feed events grow a 'list' type.
alter table public.feed_events drop constraint feed_events_type_check;
alter table public.feed_events
  add constraint feed_events_type_check
  check (type in ('rated', 'drop', 'streak', 'concert', 'list'));

alter table public.lists enable row level security;
alter table public.list_items enable row level security;

-- Same trust posture as 0001–0006 until Supabase Auth lands (blueprint §3.4).
create policy "lists are publicly readable"
  on public.lists for select using (true);
create policy "anyone can create a list"
  on public.lists for insert with check (true);
create policy "anyone can delete a list"
  on public.lists for delete using (true);

create policy "list items are publicly readable"
  on public.list_items for select using (true);
create policy "anyone can add a list item"
  on public.list_items for insert with check (true);
create policy "anyone can update a list item"
  on public.list_items for update using (true);
create policy "anyone can remove a list item"
  on public.list_items for delete using (true);
