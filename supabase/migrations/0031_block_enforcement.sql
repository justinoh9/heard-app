-- Make block enforcement real — SECURITY. Run AFTER 0030.
--
-- WHAT WAS WRONG. 0019 added a block test to the `follows` and `concert_tags`
-- insert policies: "someone you blocked must not be able to follow or tag you".
-- It has never worked. The test is a subquery over `public.blocks`, and `blocks`
-- is deliberately private-read (0019: `read own blocks` → `auth.uid() = blocker_id`),
-- because someone who can tell they've been blocked can retaliate.
--
-- A policy expression runs as the *calling* user, and RLS applies to tables it
-- reads. So when A tries to follow B, the subquery `select 1 from blocks where
-- blocker_id = B and blocked_id = A` executes as A — who is not the blocker and
-- therefore cannot see that row. `not exists (…)` was always true. The check
-- was decorative: privacy on `blocks` silently disabled enforcement.
--
-- Nothing caught it because 0019 predates the self-testing convention (which
-- starts at 0021), and a test run as the table owner would have bypassed RLS
-- and "passed" anyway.
--
-- THE FIX. A SECURITY DEFINER helper that can see the row, asked in the one
-- direction a caller is entitled to know about: "has this person blocked *me*?"
-- It takes no arbitrary pair — the second half is always `auth.uid()` — so it
-- cannot be used to enumerate anyone else's block list.
--
-- ON THE ORACLE. Once blocks are actually enforced, a blocked user can tell:
-- their follow fails. That is inherent to enforcing a block at all, and it is
-- the behaviour 0019 intended when it wrote the check. What stays protected is
-- the block *list* — who you blocked, and how many — which is what the
-- private-read policy is really for.

create or replace function public.has_blocked_me(other_id text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.blocks
    where blocker_id = other_id
      and blocked_id = auth.uid()::text
  );
$$;

comment on function public.has_blocked_me(text) is
  'Has `other_id` blocked the calling user? SECURITY DEFINER so RLS on blocks '
  'cannot hide the row from the policies that depend on it (0019''s check was '
  'silently disabled by exactly that). Only ever answers about the caller.';

-- Policies evaluate as the caller, so the caller needs EXECUTE.
revoke all on function public.has_blocked_me(text) from public;
grant execute on function public.has_blocked_me(text) to authenticated;

-- ---- follows: rebuild 0019's intent on the working check --------------------
drop policy if exists "follow as self" on public.follows;
create policy "follow as self" on public.follows for insert
  with check (
    auth.uid()::text = follower_id
    and not public.has_blocked_me(followee_id)
  );

-- ---- concert_tags: the tagged user is the one who may have blocked ----------
drop policy if exists "owner tags attendees" on public.concert_tags;
create policy "owner tags attendees" on public.concert_tags for insert
  with check (
    auth.uid()::text = (select user_id from public.concerts where id = concert_id)
    and not public.has_blocked_me(concert_tags.user_id)
  );

-- ---------------------------------------------------------------------------
-- Self-test — the one 0019 never had. Runs as `authenticated`: as the owner,
-- RLS is bypassed and every assertion below would pass vacuously.
-- ---------------------------------------------------------------------------
do $$
declare
  uid_a  text := '00000000-0000-0000-0000-00000000b101';  -- the blocked user
  uid_b  text := '00000000-0000-0000-0000-00000000b102';  -- the blocker
  uid_c  text := '00000000-0000-0000-0000-00000000b103';  -- an unrelated user
  show_b uuid := '00000000-0000-0000-0000-0000000000b9';
  blocked boolean;
  n int;
begin
  perform set_config('request.jwt.claims', '', true);
  insert into public.profiles (user_id, display_name) values
    (uid_a, 'Block Probe A'), (uid_b, 'Block Probe B'), (uid_c, 'Block Probe C');
  insert into public.blocks (blocker_id, blocked_id) values (uid_b, uid_a);

  -- ---- the blocked user cannot follow the blocker --------------------------
  perform set_config('request.jwt.claims', json_build_object('sub', uid_a)::text, true);
  blocked := false;
  begin
    set local role authenticated;
    insert into public.follows (follower_id, followee_id) values (uid_a, uid_b);
    reset role;
  exception
    when insufficient_privilege then
      reset role;
      blocked := true;
  end;
  if not blocked then
    raise exception 'SELF-TEST FAILED: a blocked user followed the person who blocked them';
  end if;

  -- ---- …but everyone else still can (the fix must not break following) -----
  perform set_config('request.jwt.claims', json_build_object('sub', uid_c)::text, true);
  set local role authenticated;
  insert into public.follows (follower_id, followee_id) values (uid_c, uid_b);
  reset role;
  select count(*) into n from public.follows where follower_id = uid_c;
  if n <> 1 then
    raise exception 'SELF-TEST FAILED: an unblocked follow was refused (got %)', n;
  end if;

  -- ---- and the blocked user may still follow unrelated people --------------
  perform set_config('request.jwt.claims', json_build_object('sub', uid_a)::text, true);
  set local role authenticated;
  insert into public.follows (follower_id, followee_id) values (uid_a, uid_c);
  reset role;

  -- ---- the blocker cannot tag the blocked user at their show ---------------
  -- B owns the show and tries to tag A. A blocked B? No — B blocked A, so the
  -- direction that must fail is A tagging B. Set up B's show first.
  perform set_config('request.jwt.claims', '', true);
  insert into public.concerts (id, user_id, artist_name, show_date)
    values (show_b, uid_a, 'Probe Band', current_date);

  perform set_config('request.jwt.claims', json_build_object('sub', uid_a)::text, true);
  blocked := false;
  begin
    set local role authenticated;
    insert into public.concert_tags (concert_id, user_id) values (show_b, uid_b);
    reset role;
  exception
    when insufficient_privilege then
      reset role;
      blocked := true;
  end;
  if not blocked then
    raise exception 'SELF-TEST FAILED: a blocked user tagged the person who blocked them';
  end if;

  -- ---- tagging someone who has not blocked you still works -----------------
  set local role authenticated;
  insert into public.concert_tags (concert_id, user_id) values (show_b, uid_c);
  reset role;
  select count(*) into n from public.concert_tags where concert_id = show_b;
  if n <> 1 then
    raise exception 'SELF-TEST FAILED: an unblocked tag was refused (got %)', n;
  end if;

  -- ---- the helper never reports on a pair that excludes the caller ---------
  -- C asks whether B blocked *C* (it did not), even though B blocked A.
  perform set_config('request.jwt.claims', json_build_object('sub', uid_c)::text, true);
  set local role authenticated;
  if public.has_blocked_me(uid_b) then
    raise exception 'SELF-TEST FAILED: has_blocked_me leaked another user''s block';
  end if;
  reset role;

  perform set_config('request.jwt.claims', '', true);
  delete from public.concert_tags where concert_id = show_b;
  delete from public.concerts where id = show_b;
  delete from public.follows where follower_id in (uid_a, uid_b, uid_c) or followee_id in (uid_a, uid_b, uid_c);
  delete from public.blocks where blocker_id in (uid_a, uid_b, uid_c);
  delete from public.profiles where user_id in (uid_a, uid_b, uid_c);

  raise notice 'Block-enforcement self-test passed.';
end;
$$;
