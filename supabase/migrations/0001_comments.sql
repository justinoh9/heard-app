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
