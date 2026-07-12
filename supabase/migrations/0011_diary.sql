-- Listen diary (ROADMAP Phase 2; PRODUCT_BLUEPRINT §1.1, §3.2). Letterboxd's
-- habit loop: a dated, RE-LOGGABLE entry per active listen. This is separate
-- from `ratings` on purpose — `ratings` stays the one-per-item canonical ranked
-- list (it drives the tie-break engine), while a diary entry is written on every
-- log action, so re-listening an album on a new date is a new timeline row that
-- feeds streaks + Wrapped without disturbing the ranked score.
--
-- One entry per item per day (unique) so a same-day re-log updates rather than
-- duplicates; a new day is a new entry. Item fields are denormalized (like
-- comments/drops) so the timeline renders in one query. Public-read (the diary
-- is part of a public profile timeline), owner-write. Run AFTER 0010.

create table public.diary_entries (
  id           uuid primary key default gen_random_uuid(),
  user_id      text not null,
  item_id      text not null,
  item_type    text not null check (item_type in ('song', 'album')),
  item_title   text not null,
  item_artist  text not null,
  item_art_url text,
  score        numeric(3, 1) check (score >= 0 and score <= 10),
  note         text,
  logged_at    date not null default current_date,
  created_at   timestamptz not null default now(),
  unique (user_id, item_id, logged_at)
);

create index diary_user_idx on public.diary_entries (user_id, logged_at desc, created_at desc);

alter table public.diary_entries enable row level security;

create policy "diary entries are publicly readable"
  on public.diary_entries for select using (true);
create policy "log own diary entry" on public.diary_entries for insert
  with check (auth.uid()::text = user_id);
-- Update path exists for the same-day upsert (ON CONFLICT DO UPDATE).
create policy "update own diary entry" on public.diary_entries for update
  using (auth.uid()::text = user_id);
create policy "delete own diary entry" on public.diary_entries for delete
  using (auth.uid()::text = user_id);
