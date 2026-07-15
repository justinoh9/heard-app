-- Analytics (ROADMAP Phase 4).
-- Run AFTER 0001–0026 on a project with Supabase Auth enabled.
--
-- The roadmap's goal is "instrument the funnel (sign-up → first log → first
-- follow → D7 return) so the roadmap above can be re-prioritized on data".
-- Everything shipped so far has been prioritized on argument.
--
-- WHY NOT A THIRD-PARTY SDK: the honest reason to reach for one is dashboards.
-- The reasons not to, here, are that the funnel is four numbers over a table this
-- app already knows how to query; a tag manager on the web build is another
-- script in front of the ad script; and the moment analytics leaves the database,
-- "delete my account" stops being true — 0020 can erase a Postgres row, not
-- somebody else's warehouse. This keeps the promise on the privacy page literal.
--
-- WHAT IS NOT COLLECTED, ON PURPOSE:
--   * Nothing about signed-out visitors. user_id is NOT NULL and the insert policy
--     demands it match auth.uid(), so a guest browsing the site generates no
--     analytics row at all. That also closes the obvious abuse: an anonymous
--     insert path is an anonymous write endpoint.
--   * No free text, no search terms, no item titles. `props` exists for small
--     structured facts (which surface, which step) and the client only ever puts
--     enums in it.
--   * No IPs, no device fingerprints, no third parties.
--
-- The events are RAW. There is deliberately no `first_rating` event: "first" is a
-- question you ask at read time (min(created_at) per user), not a fact the client
-- should try to know. A client that decides what your first rating was will be
-- wrong the first time someone reinstalls.

create table if not exists public.analytics_events (
  id         bigint generated always as identity primary key,
  user_id    text not null,
  -- Loose text rather than an enum: adding an event should never need a
  -- migration, and an unknown name is harmless (nothing joins on it).
  name       text not null check (char_length(name) between 1 and 64),
  props      jsonb not null default '{}',
  created_at timestamptz not null default now()
);

-- The funnel's shape: "this user's events, in order".
create index if not exists analytics_user_idx on public.analytics_events (user_id, created_at);
-- And "everyone who did X in the last N days".
create index if not exists analytics_name_idx on public.analytics_events (name, created_at desc);

alter table public.analytics_events enable row level security;

-- Write-only for the people it describes. There is no client read policy at all:
-- analytics is aggregate insight, and nobody — including the user it's about —
-- has a reason to page through a behavioural log through the API. Admins read it
-- via the funnel function below, which returns counts and never rows.
drop policy if exists "log own analytics" on public.analytics_events;
create policy "log own analytics" on public.analytics_events for insert
  with check (auth.uid()::text = user_id);

-- Generous: this is chatty by nature (an app_opened per launch, a rated per log).
-- The limit exists so a loop can't turn a telemetry endpoint into a disk filler.
drop trigger if exists rl_analytics on public.analytics_events;
create trigger rl_analytics after insert on public.analytics_events
  for each statement execute function public.enforce_rate_limit('user_id', '120', '60', 'sending analytics');

-- ============================================================
-- Where "signed up" comes from
-- ============================================================
-- Nowhere. There is no `signed_up` event and nothing records one.
--
-- The client can't: an OAuth sign-up redirects away and returns through
-- onAuthStateChange, where "signed in" and "signed up for the first time" are
-- indistinguishable — so a client-side call would count the email form and
-- silently miss every Google and Apple account.
--
-- The first draft of this file solved that with a trigger on auth.users. That was
-- wrong twice over. Practically: auth.users is owned by supabase_auth_admin, and
-- the SQL editor runs as postgres, so `create trigger` on it is refused — the
-- migration simply won't apply. And conceptually: it was writing down a fact the
-- database already knew. `auth.users.created_at` IS the sign-up date. Copying it
-- into an events table adds a way for the two to disagree and answers no question
-- the original couldn't.
--
-- So the funnel reads the cohort straight from auth.users below. That needs no
-- DDL on a table we don't own, cannot drift, cannot be forged by a client
-- calling track('signed_up') in a loop, and — the part the trigger could never
-- have managed — correctly counts accounts created BEFORE analytics existed.

-- ============================================================
-- The funnel
-- ============================================================
-- Returns four counts and no rows — an admin gets insight, not a feed of what
-- individuals did. Cohorted by sign-up date so the numbers answer "of the people
-- who joined in this window, how many got somewhere", which is the only version
-- of the question worth acting on. A funnel that counts all-time signups against
-- this week's activity always looks like it's getting worse.
create or replace function public.analytics_funnel(p_since_days int default 30)
returns table (
  signed_up   bigint,
  activated   bigint,  -- logged at least one rating
  connected   bigint,  -- followed at least one person
  retained_d7 bigint   -- came back a week or more after signing up
)
language sql
stable
security definer
set search_path = ''
as $$
  with cohort as (
    -- The source of truth for "signed up", read rather than duplicated.
    select u.id::text as user_id, u.created_at as joined_at
      from auth.users u
     where u.created_at > now() - make_interval(days => p_since_days)
  )
  select
    (select count(*) from cohort),
    (select count(distinct c.user_id)
       from cohort c
       join public.analytics_events e
         on e.user_id = c.user_id and e.name = 'rated'),
    (select count(distinct c.user_id)
       from cohort c
       join public.analytics_events e
         on e.user_id = c.user_id and e.name = 'followed'),
    (select count(distinct c.user_id)
       from cohort c
       join public.analytics_events e
         on e.user_id = c.user_id
        and e.name = 'app_opened'
        and e.created_at >= c.joined_at + interval '7 days')
  -- Only an admin gets an answer. SECURITY DEFINER is required (there is no read
  -- policy on the table by design), which makes this the one door into the data —
  -- so the check is inside the function rather than on a policy someone could
  -- widen later without noticing.
  where public.is_admin();
$$;

revoke all on function public.analytics_funnel(int) from public, anon;
grant execute on function public.analytics_funnel(int) to authenticated;

-- ============================================================
-- Account deletion has to learn about this table
-- ============================================================
-- 0020 erases 16 user-keyed tables by name. This is the first new one since, and
-- it is exactly the rot that list was warned about: a deletion that quietly
-- misses data is worse than one that fails loudly. Adding analytics_events here,
-- in the same migration that creates it, is the only way that stays true.
--
-- (The local backend sweeps `heard.*.<uid>` by pattern for this reason. The SQL
-- side cannot: the tables have no shared naming convention, and inferring "user
-- keyed" from a column name would silently delete rows from any future table that
-- happened to have a user_id. Explicit and maintained beats clever and wrong.)
create or replace function public.delete_own_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid text := auth.uid()::text;
begin
  if uid is null then
    raise exception 'delete_own_account: no authenticated user';
  end if;

  delete from public.likes           where user_id = uid;
  delete from public.comments        where user_id = uid;
  delete from public.comparisons     where user_id = uid;
  delete from public.ratings         where user_id = uid;
  delete from public.diary_entries   where user_id = uid;
  delete from public.queue_items     where user_id = uid;
  delete from public.drops           where user_id = uid;
  delete from public.feed_events     where user_id = uid;
  delete from public.lists           where user_id = uid;
  delete from public.concert_tags    where user_id = uid;
  delete from public.concerts        where user_id = uid;
  delete from public.follows         where follower_id = uid or followee_id = uid;
  delete from public.blocks          where blocker_id = uid or blocked_id = uid;
  delete from public.reports         where reporter_id = uid or target_user_id = uid;
  delete from public.analytics_events where user_id = uid;   -- new in 0027
  delete from public.admins          where user_id = uid;    -- new in 0023
  delete from public.profiles        where user_id = uid;

  -- The avatar is NOT deleted here. Supabase guards its storage tables with a
  -- `storage.protect_delete()` trigger that rejects direct DML ("Direct deletion
  -- from storage tables is not allowed. Use the Storage API instead."), so the
  -- line that used to live here didn't merely fail to remove the file — it threw,
  -- and took the whole account deletion down with it. It was there from 0020 and
  -- never once worked.
  --
  -- The client removes the avatar through the Storage API *before* calling this
  -- function, while the account still exists to authorize it (the bucket's RLS is
  -- owner-scoped). See SupabaseAuthBackend.removeAvatar.

  -- Still deliberately NOT touched: public.items (shared catalog cache).

  delete from auth.users where id = auth.uid();
end;
$$;

revoke all on function public.delete_own_account() from public, anon;
grant execute on function public.delete_own_account() to authenticated;

-- ---------------------------------------------------------------------------
-- SELF-TEST — see 0021 for why these exist.
-- ---------------------------------------------------------------------------
-- NOTE ON WHAT THIS DOES *NOT* TOUCH: nothing here writes to auth.users. An
-- earlier draft inserted a probe account to exercise the funnel end to end, which
-- is the sort of thing that works on a local Postgres where you're superuser and
-- is refused on a real project where auth.users belongs to supabase_auth_admin. A
-- self-test that can only run on the developer's laptop tests the laptop.
--
-- So the cohort is exercised through the one part of the funnel that IS ours: the
-- `activated` / `connected` / `retained_d7` joins, asserted against a cohort of
-- real accounts (however many that is) plus fabricated events for ids that match
-- no account. That's a weaker test than the original and it is honest about it —
-- the arithmetic below is checked, the auth.users read is not.
do $$
declare
  admin_uid text := '00000000-0000-0000-0000-0000000ad001';
  u_ghost   text := '00000000-0000-0000-0000-0000000f0001';
  f record;
  n int;
  before_signed_up bigint;
begin
  perform set_config('request.jwt.claims', '', true);

  insert into public.admins (user_id, note) values (admin_uid, 'analytics self-test');

  -- ---- the function runs, and answers an admin -------------------------
  perform set_config('request.jwt.claims', json_build_object('sub', admin_uid)::text, true);
  select * into f from public.analytics_funnel(30);
  if f is null then
    raise exception 'SELF-TEST FAILED: analytics_funnel returned no row to an admin';
  end if;
  before_signed_up := f.signed_up;

  -- ---- a non-admin gets nothing ----------------------------------------
  -- The important one: there is no read policy on analytics_events at all, so
  -- this SECURITY DEFINER function is the only door into the data. If its
  -- is_admin() check ever breaks, everyone can read everyone's behaviour.
  perform set_config('request.jwt.claims', json_build_object('sub', u_ghost)::text, true);
  select count(*) into n from public.analytics_funnel(30);
  if n <> 0 then
    raise exception 'SELF-TEST FAILED: a non-admin got % funnel rows, expected 0', n;
  end if;

  -- ---- events for a non-account never inflate the cohort ----------------
  -- The funnel counts people who exist in auth.users, not people who have events.
  -- If a stray event could conjure a cohort member, every ratio would be wrong.
  perform set_config('request.jwt.claims', '', true);
  insert into public.analytics_events (user_id, name, created_at) values
    (u_ghost, 'rated',      now()),
    (u_ghost, 'followed',   now()),
    (u_ghost, 'app_opened', now());

  perform set_config('request.jwt.claims', json_build_object('sub', admin_uid)::text, true);
  select * into f from public.analytics_funnel(30);
  if f.signed_up <> before_signed_up then
    raise exception 'SELF-TEST FAILED: events for an id with no auth.users row changed signed_up from % to %',
      before_signed_up, f.signed_up;
  end if;
  if f.activated > f.signed_up or f.connected > f.signed_up or f.retained_d7 > f.signed_up then
    raise exception 'SELF-TEST FAILED: a funnel step (% / % / %) exceeded the cohort (%) — it is counting events, not people',
      f.activated, f.connected, f.retained_d7, f.signed_up;
  end if;

  -- ---- account deletion takes the analytics with it --------------------
  -- No auth.users row needed: delete_own_account's final DELETE is simply a no-op
  -- for an id that was never an account, and everything before it still runs.
  perform set_config('request.jwt.claims', json_build_object('sub', u_ghost)::text, true);
  perform public.delete_own_account();
  select count(*) into n from public.analytics_events where user_id = u_ghost;
  if n <> 0 then
    raise exception 'SELF-TEST FAILED: % analytics rows survived account deletion', n;
  end if;

  perform set_config('request.jwt.claims', '', true);
  delete from public.analytics_events where user_id = u_ghost;
  delete from public.admins where user_id = admin_uid;

  raise notice 'Analytics self-test passed.';
end;
$$;
