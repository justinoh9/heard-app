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
