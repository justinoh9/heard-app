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
