-- Social spine (PRODUCT_BLUEPRINT §2.C, build order item 4): the follow graph
-- and the activity feed that every meaningful action writes into.
--
--   profiles    — a public directory of users (LocalAuthBackend ids), upserted
--                 at sign-in so people can find and follow each other. Becomes
--                 redundant when auth migrates to Supabase Auth (§3.4).
--   follows     — who follows whom. The feed is "events by people I follow".
--   feed_events — append-only activity log (blueprint §3.2). `payload` is
--                 type-specific JSON (item, score, caption, …) so new event
--                 types don't need migrations.

create table public.profiles (
  user_id      text primary key,              -- LocalAuthBackend user.id
  display_name text not null,
  updated_at   timestamptz not null default now()
);

create table public.follows (
  follower_id text not null,
  followee_id text not null,
  created_at  timestamptz not null default now(),
  primary key (follower_id, followee_id),
  check (follower_id <> followee_id)
);

create index follows_followee_idx on public.follows (followee_id);

create table public.feed_events (
  id           uuid primary key default gen_random_uuid(),
  user_id      text not null,
  display_name text not null,                 -- denormalized for one-query feeds
  type         text not null check (type in ('rated', 'drop', 'streak')),
  payload      jsonb not null default '{}',
  created_at   timestamptz not null default now()
);

create index feed_events_user_idx on public.feed_events (user_id, created_at desc);

alter table public.profiles enable row level security;
alter table public.follows enable row level security;
alter table public.feed_events enable row level security;

-- Same trust posture as 0001–0003: no Supabase Auth session exists, so writes
-- trust the client-supplied ids. Revisit with auth (blueprint §3.4).

create policy "profiles are publicly readable"
  on public.profiles for select using (true);
create policy "anyone can create a profile"
  on public.profiles for insert with check (true);
create policy "anyone can update a profile"
  on public.profiles for update using (true);

create policy "follows are publicly readable"
  on public.follows for select using (true);
create policy "anyone can follow"
  on public.follows for insert with check (true);
create policy "anyone can unfollow"
  on public.follows for delete using (true);

create policy "feed events are publicly readable"
  on public.feed_events for select using (true);
create policy "anyone can publish a feed event"
  on public.feed_events for insert with check (true);
-- Append-only: no update/delete — the activity log is history, not state.
