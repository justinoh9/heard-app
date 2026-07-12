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
