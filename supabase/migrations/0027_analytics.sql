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
-- signed_up: recorded by the database, not the client
-- ============================================================
-- The head of the funnel has to be right or none of the ratios mean anything.
-- The client cannot get it right: an OAuth sign-up redirects away and returns
-- through onAuthStateChange, where "signed in" and "signed up for the first time"
-- look the same — so a client-side call would count the email form and silently
-- miss every Google and Apple account. Guessing from the app side ("no ratings
-- yet") would then fire again for anyone who cleared their list.
--
-- A trigger on auth.users sees every route in — email, OAuth, magic link, an
-- invite created from the dashboard — exactly once, and can't be forged by a
-- client that just calls track('signed_up') in a loop.
create or replace function public.log_signup()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.analytics_events (user_id, name, props)
    values (new.id::text, 'signed_up', jsonb_build_object('provider',
      coalesce(new.raw_app_meta_data ->> 'provider', 'unknown')));
  return new;
exception when others then
  -- Never let telemetry break account creation. If this insert fails for any
  -- reason, the sign-up must still succeed: a missing analytics row is a gap in a
  -- chart, a failed sign-up is a lost user.
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_analytics on auth.users;
create trigger on_auth_user_created_analytics
  after insert on auth.users
  for each row execute function public.log_signup();

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
    select user_id, min(created_at) as joined_at
      from public.analytics_events
     where name = 'signed_up'
       and created_at > now() - make_interval(days => p_since_days)
     group by user_id
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

  delete from storage.objects
    where bucket_id = 'avatars' and (storage.foldername(name))[1] = uid;

  -- Still deliberately NOT touched: public.items (shared catalog cache).

  delete from auth.users where id = auth.uid();
end;
$$;

revoke all on function public.delete_own_account() from public, anon;
grant execute on function public.delete_own_account() to authenticated;

-- ---------------------------------------------------------------------------
-- SELF-TEST — see 0021 for why these exist.
-- ---------------------------------------------------------------------------
do $$
declare
  admin_uid text := '00000000-0000-0000-0000-0000000ad001';
  u_full    text := '00000000-0000-0000-0000-0000000f0001';  -- did everything
  u_lapsed  text := '00000000-0000-0000-0000-0000000f0002';  -- signed up, rated, left
  u_old     text := '00000000-0000-0000-0000-0000000f0003';  -- outside the window
  u_new     text := '00000000-0000-0000-0000-0000000f0004';  -- created via the trigger
  f record;
  n int;
  got text;
begin
  perform set_config('request.jwt.claims', '', true);

  insert into public.admins (user_id, note) values (admin_uid, 'analytics self-test');

  insert into public.analytics_events (user_id, name, created_at) values
    (u_full,   'signed_up',  now() - interval '20 days'),
    (u_full,   'rated',      now() - interval '20 days'),
    (u_full,   'followed',   now() - interval '19 days'),
    (u_full,   'app_opened', now() - interval '5 days'),   -- 15 days after joining
    (u_lapsed, 'signed_up',  now() - interval '10 days'),
    (u_lapsed, 'rated',      now() - interval '10 days'),
    (u_lapsed, 'app_opened', now() - interval '10 days'),  -- same day: NOT retained
    (u_old,    'signed_up',  now() - interval '400 days'),
    (u_old,    'rated',      now() - interval '400 days');

  -- ---- the funnel counts the right people ------------------------------
  perform set_config('request.jwt.claims', json_build_object('sub', admin_uid)::text, true);
  select * into f from public.analytics_funnel(30);

  if f.signed_up <> 2 then
    raise exception 'SELF-TEST FAILED: signed_up = %, expected 2 (the 400-day-old signup is outside the window)', f.signed_up;
  end if;
  if f.activated <> 2 then
    raise exception 'SELF-TEST FAILED: activated = %, expected 2', f.activated;
  end if;
  if f.connected <> 1 then
    raise exception 'SELF-TEST FAILED: connected = %, expected 1', f.connected;
  end if;
  -- The one that's easy to get wrong: an app_opened on signup day is not a D7
  -- return. If this reads 2, the funnel is counting sessions, not retention.
  if f.retained_d7 <> 1 then
    raise exception 'SELF-TEST FAILED: retained_d7 = %, expected 1 (a same-day open is not a return)', f.retained_d7;
  end if;

  -- ---- a non-admin gets nothing ----------------------------------------
  perform set_config('request.jwt.claims', json_build_object('sub', u_full)::text, true);
  select count(*) into n from public.analytics_funnel(30);
  if n <> 0 then
    raise exception 'SELF-TEST FAILED: a non-admin got % funnel rows, expected 0', n;
  end if;

  -- ---- the signup trigger fires for EVERY route in ---------------------
  -- A fresh id with no fixture events of its own, so the count below is only
  -- what the trigger did. Inserted the way an OAuth sign-up arrives — the case a
  -- client-side track() call can never see.
  perform set_config('request.jwt.claims', '', true);
  insert into auth.users (id, raw_app_meta_data)
    values (u_new::uuid, jsonb_build_object('provider', 'google'));
  select count(*) into n
    from public.analytics_events where user_id = u_new and name = 'signed_up';
  if n <> 1 then
    raise exception 'SELF-TEST FAILED: creating an auth user logged % signed_up events, expected exactly 1', n;
  end if;
  select props ->> 'provider' into got
    from public.analytics_events where user_id = u_new and name = 'signed_up';
  if got is distinct from 'google' then
    raise exception 'SELF-TEST FAILED: signup provider recorded as %, expected google', got;
  end if;

  -- ---- account deletion takes the analytics with it --------------------
  perform set_config('request.jwt.claims', json_build_object('sub', u_new)::text, true);
  perform public.delete_own_account();
  select count(*) into n from public.analytics_events where user_id = u_new;
  if n <> 0 then
    raise exception 'SELF-TEST FAILED: % analytics rows survived account deletion', n;
  end if;

  perform set_config('request.jwt.claims', '', true);
  delete from public.analytics_events where user_id in (u_lapsed, u_old);
  delete from public.admins where user_id = admin_uid;

  raise notice 'Analytics self-test passed.';
end;
$$;
