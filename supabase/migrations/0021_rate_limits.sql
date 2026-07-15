-- Rate limits (ROADMAP Phase 4 — moderation & safety).
-- Run AFTER 0001–0020 on a project with Supabase Auth enabled.
--
-- Blocking and reporting (0019) let a user defend themselves from another user.
-- Rate limits defend everyone from a script. They must live in the database:
-- the client cannot enforce a limit it is able to skip, and RLS answers "may you
-- write this row?", never "how many have you written this minute?".
--
-- WHAT IS LIMITED, AND WHY THOSE:
-- The rule is *actions that consume someone else's attention, or that a bot can
-- use to flood a shared surface* — comments, likes, follows, feed events,
-- concerts, tags, ratings, reports. Deliberately NOT limited:
--   * public.blocks   — blocking is self-defense. Someone mass-blocking a brigade
--                       is the system working; throttling them helps the brigade.
--   * diary_entries / queue_items / lists / drops — private, or already unique
--                       per user. They spam nobody, so a limit is pure downside.
--
-- WHY AFTER ... FOR EACH STATEMENT:
-- The obvious build is BEFORE INSERT FOR EACH ROW. The worry with it is batching:
-- PostgREST turns `.insert([...])` into ONE multi-row INSERT, so if a BEFORE ROW
-- trigger could not see the earlier rows of its own statement, every row in the
-- batch would count zero and 10,000 comments would arrive in a single request the
-- limiter waved through.
--
-- That worry turns out to be unfounded, and it was worth checking rather than
-- believing: plpgsql bumps the command counter for each query it runs, so a
-- BEFORE ROW trigger *does* see its statement's earlier rows. Tested directly on
-- PG15 — a 50-row batch against a limit of 2 was caught with 0 rows landing.
--
-- AFTER STATEMENT is still the better fit, for two duller reasons. It runs one
-- COUNT per statement instead of one per row, so it gets cheaper exactly when a
-- batch makes it matter. And its visibility is guaranteed by definition rather
-- than by an implementation detail of how plpgsql happens to take snapshots —
-- which is a thing to lean on for a security control that nobody will re-derive
-- in two years. The cost is doing the work before rejecting it; going over raises
-- and the whole statement rolls back. The self-test at the bottom asserts the
-- batch case regardless, so a future change of heart stays honest.
--
-- HOW THE LIMIT REPORTS ITSELF:
-- `PT429` is not arbitrary. PostgREST reads a SQLSTATE of the form PTxxx and
-- uses the last three digits as the HTTP status, so this reaches the client as a
-- real 429 Too Many Requests rather than a generic 400. The message is written
-- for the end user, because it is displayed verbatim.

-- ---------------------------------------------------------------------------
-- concert_tags needs a timestamp before it can be rate limited (0006 created it
-- without one — its primary key is (concert_id, user_id), so nothing dated it).
-- Existing rows backfill to now(); that only affects rate limiting, which has no
-- history to be wrong about.
-- ---------------------------------------------------------------------------
alter table public.concert_tags
  add column if not exists created_at timestamptz not null default now();

-- ---------------------------------------------------------------------------
-- The generic limiter.
--
-- Trigger arguments: (actor_column, max_rows, window_seconds, gerund)
--   actor_column — the column naming *who is acting*. It is a parameter, not a
--                  hardcoded `user_id`, because those differ: follows records the
--                  actor in `follower_id`, reports in `reporter_id`. Hardcoding
--                  user_id would throttle the person being followed or reported —
--                  the victim rather than the abuser.
--   gerund       — used in the message ("commenting too quickly").
--
-- SECURITY DEFINER is load-bearing, not ceremony. The count must see every row
-- the actor has written, and some of these tables are private-read (0019: you can
-- select only your own reports). Under the caller's own privileges RLS would
-- filter the COUNT and quietly return a number too low — and a limiter that reads
-- 0 never fires. Running as owner makes the count true.
--
-- Its safety is the same posture as delete_own_account() in 0020: it takes no
-- caller-supplied arguments (tg_argv comes from the trigger definitions below,
-- which only a migration can write), derives the actor from auth.uid() alone, and
-- pins an empty search_path with every name schema-qualified.
-- ---------------------------------------------------------------------------
create or replace function public.enforce_rate_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_col text := tg_argv[0];
  max_rows  int  := tg_argv[1]::int;
  window_s  int  := tg_argv[2]::int;
  gerund    text := tg_argv[3];
  actor     text;
  n         int;
begin
  actor := auth.uid()::text;

  -- No JWT means this is not a user request: the service role running a backfill,
  -- a migration, or a dashboard query. Those are trusted and must not be
  -- throttled. Client writes always carry one — 0007's policies require
  -- auth.uid() to match, so an anonymous client write is already impossible.
  if actor is null then
    return null;
  end if;

  -- Dynamic because the table varies per trigger. %I quotes the identifiers, and
  -- they come from the trigger definition rather than any caller, so there is no
  -- injection surface.
  execute format(
    'select count(*) from %I.%I where %I = $1 and created_at > now() - make_interval(secs => $2)',
    tg_table_schema, tg_table_name, actor_col
  )
  into n
  using actor, window_s;

  -- Strictly greater: this runs AFTER the insert, so the new rows are already
  -- counted. n = max_rows is the limit exactly met, which is allowed.
  if n > max_rows then
    raise exception
      using
        errcode = 'PT429',
        message = format(
          'You''re %s too quickly — the limit is %s per %s seconds. Give it a moment and try again.',
          gerund, max_rows, window_s
        );
  end if;

  return null;  -- ignored for AFTER STATEMENT triggers
end;
$$;

revoke all on function public.enforce_rate_limit() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Concert tags need their own limiter, because the generic one cannot express
-- them: `concert_tags.user_id` is the person being TAGGED, while the person doing
-- the tagging is the owner of the concert. Pointing the generic limiter at
-- user_id would throttle people for being popular, and leave a spammer tagging
-- 500 strangers on one show entirely unlimited.
--
-- So: count the tags on concerts owned by the actor.
-- ---------------------------------------------------------------------------
create or replace function public.enforce_concert_tag_rate_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  max_rows int := tg_argv[0]::int;
  window_s int := tg_argv[1]::int;
  actor    text;
  n        int;
begin
  actor := auth.uid()::text;
  if actor is null then
    return null;
  end if;

  select count(*)
    into n
    from public.concert_tags t
    join public.concerts c on c.id = t.concert_id
   where c.user_id = actor
     and t.created_at > now() - make_interval(secs => window_s);

  if n > max_rows then
    raise exception
      using
        errcode = 'PT429',
        message = format(
          'You''re tagging people too quickly — the limit is %s per %s seconds. Give it a moment and try again.',
          max_rows, window_s
        );
  end if;

  return null;
end;
$$;

revoke all on function public.enforce_concert_tag_rate_limit() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- The limits themselves.
--
-- Calibrated to be invisible to a person and fatal to a script. The one to watch
-- is ratings: onboarding rapid-rates ~10 albums in a burst and every log also
-- writes a diary entry, so the ceiling sits well above any human burst. If a real
-- user ever hits one of these, the limit is wrong — not the user.
-- ---------------------------------------------------------------------------
drop trigger if exists rl_comments on public.comments;
create trigger rl_comments after insert on public.comments
  for each statement execute function public.enforce_rate_limit('user_id', '10', '60', 'commenting');

drop trigger if exists rl_likes on public.likes;
create trigger rl_likes after insert on public.likes
  for each statement execute function public.enforce_rate_limit('user_id', '60', '60', 'liking things');

drop trigger if exists rl_follows on public.follows;
create trigger rl_follows after insert on public.follows
  for each statement execute function public.enforce_rate_limit('follower_id', '30', '60', 'following people');

drop trigger if exists rl_feed_events on public.feed_events;
create trigger rl_feed_events after insert on public.feed_events
  for each statement execute function public.enforce_rate_limit('user_id', '20', '60', 'posting');

drop trigger if exists rl_concerts on public.concerts;
create trigger rl_concerts after insert on public.concerts
  for each statement execute function public.enforce_rate_limit('user_id', '10', '60', 'logging shows');

drop trigger if exists rl_ratings on public.ratings;
create trigger rl_ratings after insert on public.ratings
  for each statement execute function public.enforce_rate_limit('user_id', '60', '60', 'rating music');

-- Reports get a tighter window: a real person files one, thinks, maybe files
-- another. A burst is someone weaponizing the report queue.
drop trigger if exists rl_reports on public.reports;
create trigger rl_reports after insert on public.reports
  for each statement execute function public.enforce_rate_limit('reporter_id', '5', '300', 'reporting things');

drop trigger if exists rl_concert_tags on public.concert_tags;
create trigger rl_concert_tags after insert on public.concert_tags
  for each statement execute function public.enforce_concert_tag_rate_limit('20', '60');

-- ---------------------------------------------------------------------------
-- SELF-TEST
--
-- This migration proves itself when you run it. A rate limiter is exactly the
-- kind of code that looks right and silently does nothing — an off-by-one, a
-- column that doesn't exist, an RLS-truncated count, a batch that slips past —
-- and you would not find out until a bot showed you. If any assertion below
-- fails, this migration raises and rolls back rather than leaving you with a
-- limiter that is only decorative.
--
-- auth.uid() reads the `request.jwt.claims` GUC, so set_config lets us act as a
-- fabricated user without creating one.
-- ---------------------------------------------------------------------------
do $$
declare
  uid_a text := '00000000-0000-0000-0000-0000000000aa';
  uid_b text := '00000000-0000-0000-0000-0000000000bb';
  probe_concert uuid := '00000000-0000-0000-0000-0000000000c1';
  tripped boolean;
begin
  -- ---- the generic limiter, on a throwaway table -------------------------
  -- A temp table carrying the real trigger tests the real function without
  -- writing one row to a real table.
  create temp table rl_probe (
    user_id    text,
    created_at timestamptz not null default now()
  );
  create trigger rl_probe_t after insert on rl_probe
    for each statement execute function public.enforce_rate_limit('user_id', '2', '60', 'probing');

  perform set_config('request.jwt.claims', json_build_object('sub', uid_a)::text, true);

  -- Rows outside the window must not count. These are two hours old; if the
  -- window were ignored, the fresh inserts below would trip.
  insert into rl_probe (user_id, created_at) values (uid_a, now() - interval '2 hours');
  insert into rl_probe (user_id, created_at) values (uid_a, now() - interval '2 hours');

  -- Two fresh rows are exactly the limit, so both must be allowed.
  insert into rl_probe (user_id) values (uid_a);
  insert into rl_probe (user_id) values (uid_a);

  -- The third must trip.
  tripped := false;
  begin
    insert into rl_probe (user_id) values (uid_a);
  exception when sqlstate 'PT429' then
    tripped := true;
  end;
  if not tripped then
    raise exception 'SELF-TEST FAILED: enforce_rate_limit allowed a 3rd row past a limit of 2';
  end if;

  -- A different actor must be unaffected — the limit is per-user, not global.
  perform set_config('request.jwt.claims', json_build_object('sub', uid_b)::text, true);
  insert into rl_probe (user_id) values (uid_b);

  -- THE BATCH CASE. This is the assertion the whole AFTER STATEMENT design
  -- exists for: a single multi-row insert must be caught, not waved through.
  perform set_config('request.jwt.claims', json_build_object('sub', uid_b)::text, true);
  tripped := false;
  begin
    insert into rl_probe (user_id) select uid_b from generate_series(1, 50);
  exception when sqlstate 'PT429' then
    tripped := true;
  end;
  if not tripped then
    raise exception 'SELF-TEST FAILED: a 50-row batch insert slipped past a limit of 2';
  end if;

  -- No JWT (service role / migration) must bypass, even for an actor already
  -- over the limit.
  perform set_config('request.jwt.claims', '', true);
  insert into rl_probe (user_id) values (uid_a);

  drop table rl_probe;

  -- ---- the concert-tag limiter, which needs the real tables --------------
  -- Uses a fabricated owner id matching no real account, and cleans up after
  -- itself. If an assertion raises, this block's subtransaction rolls the probe
  -- rows back on its own.
  perform set_config('request.jwt.claims', json_build_object('sub', uid_a)::text, true);
  insert into public.concerts (id, user_id, artist_name, show_date)
    values (probe_concert, uid_a, 'Rate limit probe', current_date);

  -- Tag 20 people (exactly the limit) on our own show: allowed.
  insert into public.concert_tags (concert_id, user_id)
    select probe_concert, '00000000-0000-0000-0000-' || lpad(i::text, 12, '0')
      from generate_series(1, 20) as g(i);

  -- The 21st must trip. Note the tagged user has never tagged anyone: this
  -- asserts we count by the concert's OWNER, not by the tagged user_id.
  tripped := false;
  begin
    insert into public.concert_tags (concert_id, user_id) values (probe_concert, uid_b);
  exception when sqlstate 'PT429' then
    tripped := true;
  end;
  if not tripped then
    raise exception 'SELF-TEST FAILED: enforce_concert_tag_rate_limit allowed a 21st tag past a limit of 20';
  end if;

  delete from public.concerts where id = probe_concert;  -- tags cascade

  raise notice 'Rate-limit self-test passed.';
end;
$$;
