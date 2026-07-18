-- Badge feed events (ROADMAP Phase 3 follow-up; Growth playbook: Social
-- Currency + Public). Badges shipped silent — earned on the Profile wall,
-- invisible to everyone else. But an achievement nobody sees is social
-- currency nobody can spend: the whole point of game mechanics (Contagious,
-- STEPPS) is that they're *visible*. So an earn now publishes a feed event.
--
-- A badge earn is just another feed_events row (type 'badge'); the payload
-- carries { badgeId, title }. The only schema change is widening the type
-- check — the same pattern as 0006 (concert), 0010 (made_list), and 0013
-- (repost). The client detects earns device-locally (src/badges/announce.ts)
-- and publishes best-effort: on a project that hasn't run this migration the
-- insert bounces off the old check and the app carries on. Run AFTER 0028.

alter table public.feed_events drop constraint feed_events_type_check;
alter table public.feed_events
  add constraint feed_events_type_check
  check (type in ('rated', 'drop', 'streak', 'concert', 'made_list', 'repost', 'badge'));

-- ---------------------------------------------------------------------------
-- Self-test. The check constraint is role-independent, so this runs as the
-- migration role; RLS on feed_events is 0007's and isn't re-proved here.
-- Asserts only about rows it created, with probe values nothing real collides
-- with, and cleans up after itself (the harness replays this against a seeded
-- database on pass 2).
-- ---------------------------------------------------------------------------
do $$
declare
  probe text := '00000000-0000-0000-0000-00000000ba01';
  n int;
begin
  insert into public.profiles (user_id, display_name)
    values (probe, 'Badge Probe');

  -- A 'badge' event must now be accepted.
  insert into public.feed_events (user_id, display_name, type, payload)
    values (probe, 'Badge Probe', 'badge',
            '{"badgeId": "probe-badge", "title": "Probe Badge"}'::jsonb);
  select count(*) into n from public.feed_events
    where user_id = probe and type = 'badge';
  if n <> 1 then
    raise exception 'SELF-TEST FAILED: a badge event did not land (got % rows)', n;
  end if;

  -- The check must still be a check: an unknown type stays rejected.
  begin
    insert into public.feed_events (user_id, display_name, type, payload)
      values (probe, 'Badge Probe', 'not-a-real-type', '{}'::jsonb);
    raise exception 'SELF-TEST FAILED: the widened check accepts arbitrary types';
  exception
    when check_violation then null; -- exactly what we want
  end;

  delete from public.feed_events where user_id = probe;
  delete from public.profiles where user_id = probe;

  raise notice 'Badge-events self-test passed.';
end;
$$;
