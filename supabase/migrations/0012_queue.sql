-- Want-to-listen queue (ROADMAP Phase 2 / G1; PRODUCT_BLUEPRINT §2.A). The
-- biggest missing Beli/Letterboxd mechanic: a one-tap bookmark on any
-- song/album that feeds a personal listen-later list ("what do I play next?").
--
-- Distinct from `ratings` (already listened, ranked) and `diary_entries` (dated
-- listens) — this is the pre-listen intent list. One row per (user, item);
-- bookmarking again is a no-op upsert, un-bookmarking deletes. Item fields are
-- denormalized (like diary/comments/drops) so the list renders in one query
-- without joining `items`. Public-read (a "want to listen" count is a profile
-- stat and the list is part of a public profile), owner-write/delete. Run
-- AFTER 0011.

create table public.queue_items (
  id           uuid primary key default gen_random_uuid(),
  user_id      text not null,
  item_id      text not null,
  item_type    text not null check (item_type in ('song', 'album')),
  item_title   text not null,
  item_artist  text not null,
  item_art_url text,
  created_at   timestamptz not null default now(),
  unique (user_id, item_id)
);

create index queue_user_idx on public.queue_items (user_id, created_at desc);

alter table public.queue_items enable row level security;

create policy "queue items are publicly readable"
  on public.queue_items for select using (true);
create policy "add to own queue" on public.queue_items for insert
  with check (auth.uid()::text = user_id);
create policy "remove from own queue" on public.queue_items for delete
  using (auth.uid()::text = user_id);
