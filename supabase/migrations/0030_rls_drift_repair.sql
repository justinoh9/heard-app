-- RLS DRIFT REPAIR — SECURITY. Run this on production as soon as possible.
--
-- WHAT WAS WRONG
-- Probing the live project on 2026-07-18 (anon key only, the one that ships in
-- the public web bundle) showed anonymous INSERTs being accepted, with an
-- arbitrary `user_id`, on: feed_events, ratings, follows, profiles, concerts,
-- comparisons, items, and concert_tags. Anyone could forge activity, ratings,
-- follows, and profiles as anybody.
--
-- WHY. 0007 hardened these tables by dropping each table's original
-- "anyone can …" policy and creating an owner-scoped one. On production only
-- its first two sections (comments, likes) took effect — everything from the
-- `items` section onward did not. The signature of a SQL run that stopped
-- partway down the file. The permissive originals from 0001–0006 therefore
-- survived, and **PostgreSQL ORs permissive policies together**: once
-- `with check (true)` is in the set, no later owner-scoped policy can take
-- anything away. That is why 0019's block-aware `follow as self` looked right
-- and still let anyone insert — it was ORed with "anyone can follow".
--
-- WHY NOTHING CAUGHT IT. `test:migrations` proves the SQL is correct against a
-- fresh database, and it passes — the bug is not in the SQL. `check:live`
-- probes for columns, tables, functions, and buckets, and it also passes —
-- policies are invisible to it. A migration can be written correctly, prove
-- itself correct, and still not be *in effect*. `scripts/check-live-schema.sh`
-- now probes writes as anon so this class of drift is visible.
--
-- WHAT THIS DOES. Drops every legacy permissive policy by name and re-asserts
-- the current intended one, so it converges from any state and is safe to run
-- more than once. For `follows` and `concert_tags` the intended policy is
-- 0019's block-aware version (NOT 0007's weaker one) — re-asserting the older
-- text here would quietly undo moderation. Run AFTER 0029.

-- ---------------------------------------------------------------------------
-- 1. Drop the legacy permissive policies. `if exists` makes each a no-op where
--    0007 already landed (comments, likes). These names come from 0001–0006.
-- ---------------------------------------------------------------------------
drop policy if exists "anyone can insert a comment"      on public.comments;
drop policy if exists "anyone can insert a like"         on public.likes;
drop policy if exists "anyone can delete a like"         on public.likes;
drop policy if exists "anyone can cache an item"         on public.items;
drop policy if exists "anyone can refresh a cached item" on public.items;
drop policy if exists "anyone can insert a rating"       on public.ratings;
drop policy if exists "anyone can update a rating"       on public.ratings;
drop policy if exists "anyone can insert a comparison"   on public.comparisons;
drop policy if exists "anyone can create a profile"      on public.profiles;
drop policy if exists "anyone can update a profile"      on public.profiles;
drop policy if exists "anyone can follow"                on public.follows;
drop policy if exists "anyone can unfollow"              on public.follows;
drop policy if exists "anyone can publish a feed event"  on public.feed_events;
drop policy if exists "anyone can log a concert"         on public.concerts;
drop policy if exists "anyone can tag attendees"         on public.concert_tags;

-- ---------------------------------------------------------------------------
-- 2. Re-assert the intended write policies (0007's, except where a later
--    migration owns a stronger version). Drop-then-create so this is idempotent.
-- ---------------------------------------------------------------------------

-- items: shared catalog cache — any signed-in user may cache. Insert-only:
-- 0008 removed the update path so nobody can rewrite shared metadata.
drop policy if exists "authed can cache an item" on public.items;
create policy "authed can cache an item" on public.items for insert
  with check (auth.uid() is not null);
drop policy if exists "authed can refresh an item" on public.items;

-- ratings
drop policy if exists "insert own rating" on public.ratings;
create policy "insert own rating" on public.ratings for insert
  with check (auth.uid()::text = user_id);
drop policy if exists "update own rating" on public.ratings;
create policy "update own rating" on public.ratings for update
  using (auth.uid()::text = user_id);

-- comparisons
drop policy if exists "insert own comparison" on public.comparisons;
create policy "insert own comparison" on public.comparisons for insert
  with check (auth.uid()::text = user_id);

-- profiles
drop policy if exists "create own profile" on public.profiles;
create policy "create own profile" on public.profiles for insert
  with check (auth.uid()::text = user_id);
drop policy if exists "update own profile" on public.profiles;
create policy "update own profile" on public.profiles for update
  using (auth.uid()::text = user_id);

-- feed_events (append-only: 0008 owns the delete policy, no update policy)
drop policy if exists "publish own feed event" on public.feed_events;
create policy "publish own feed event" on public.feed_events for insert
  with check (auth.uid()::text = user_id);

-- concerts
drop policy if exists "log own concert" on public.concerts;
create policy "log own concert" on public.concerts for insert
  with check (auth.uid()::text = user_id);

-- follows: 0019's version — ownership AND "someone you blocked can't follow
-- you back". Re-asserting 0007's text here would drop the block test.
drop policy if exists "follow as self" on public.follows;
create policy "follow as self" on public.follows for insert
  with check (
    auth.uid()::text = follower_id
    and not exists (
      select 1 from public.blocks
      where blocker_id = followee_id and blocked_id = auth.uid()::text
    )
  );
drop policy if exists "unfollow as self" on public.follows;
create policy "unfollow as self" on public.follows for delete
  using (auth.uid()::text = follower_id);

-- concert_tags: 0019's version, same reasoning as follows.
drop policy if exists "owner tags attendees" on public.concert_tags;
create policy "owner tags attendees" on public.concert_tags for insert
  with check (
    auth.uid()::text = (select user_id from public.concerts where id = concert_id)
    and not exists (
      select 1 from public.blocks
      where blocker_id = concert_tags.user_id and blocked_id = auth.uid()::text
    )
  );

-- ---------------------------------------------------------------------------
-- 3. Remove the four probe rows the 2026-07-18 audit wrote into feed_events
--    while discovering this. Targeted by their exact ids so this can never
--    touch real activity; a no-op on any database that isn't that project.
-- ---------------------------------------------------------------------------
delete from public.feed_events
 where id in (
   'caebd7e1-0d61-4d7e-8893-feaffba07f4c',
   '257358da-e7cd-4ca9-9f61-25d6503da3c0',
   '25a3204c-2739-44fd-abb1-9f11a40f2027',
   '14dfbfa1-4eb1-4d92-b70b-8a7b8a4502e7'
 );

-- ---------------------------------------------------------------------------
-- Self-test. Runs as `anon` and as `authenticated`, because the table owner
-- bypasses RLS and a test as `postgres` would assert nothing at all — which is
-- precisely how this drift stayed invisible.
-- ---------------------------------------------------------------------------
do $$
declare
  uid_a  text := '00000000-0000-0000-0000-00000000d001';
  uid_b  text := '00000000-0000-0000-0000-00000000d002';
  n int;
begin
  perform set_config('request.jwt.claims', '', true);
  insert into public.profiles (user_id, display_name)
    values (uid_a, 'Drift Probe A'), (uid_b, 'Drift Probe B');

  -- ---- anon cannot publish a feed event as anybody --------------------------
  begin
    set local role anon;
    insert into public.feed_events (user_id, display_name, type, payload)
      values (uid_a, 'Drift Probe A', 'rated', '{}'::jsonb);
    reset role;
    raise exception 'SELF-TEST FAILED: anon inserted a feed event';
  exception
    when insufficient_privilege then reset role;
  end;

  -- ---- anon cannot create a profile ----------------------------------------
  begin
    set local role anon;
    insert into public.profiles (user_id, display_name) values ('anon-forged', 'Forged');
    reset role;
    raise exception 'SELF-TEST FAILED: anon created a profile';
  exception
    when insufficient_privilege then reset role;
  end;

  -- ---- anon cannot rate as somebody else -----------------------------------
  begin
    set local role anon;
    insert into public.ratings (user_id, item_id, score, tiebreak)
      values (uid_a, 'probe-item', 9, 0);
    reset role;
    raise exception 'SELF-TEST FAILED: anon inserted a rating';
  exception
    when insufficient_privilege then reset role;
  end;

  -- ---- a signed-in user cannot publish AS SOMEONE ELSE ----------------------
  perform set_config('request.jwt.claims', json_build_object('sub', uid_a)::text, true);
  begin
    set local role authenticated;
    insert into public.feed_events (user_id, display_name, type, payload)
      values (uid_b, 'Drift Probe B', 'rated', '{}'::jsonb);
    reset role;
    raise exception 'SELF-TEST FAILED: a user published a feed event as another user';
  exception
    when insufficient_privilege then reset role;
  end;

  -- ---- but CAN publish as themselves (the fix must not break the app) ------
  set local role authenticated;
  insert into public.feed_events (user_id, display_name, type, payload)
    values (uid_a, 'Drift Probe A', 'badge', '{"badgeId":"probe","title":"Probe"}'::jsonb);
  reset role;
  select count(*) into n from public.feed_events where user_id = uid_a;
  if n <> 1 then
    raise exception 'SELF-TEST FAILED: the owner could not publish their own event (got %)', n;
  end if;

  -- ---- follows enforces ownership ------------------------------------------
  -- (The *block* half of this policy is separately broken and is repaired by
  -- 0031 — see its header. This asserts only what 0030 itself guarantees.)
  begin
    set local role authenticated;
    insert into public.follows (follower_id, followee_id) values (uid_b, uid_a);
    reset role;
    raise exception 'SELF-TEST FAILED: a user created a follow as another user';
  exception
    when insufficient_privilege then reset role;
  end;

  perform set_config('request.jwt.claims', '', true);
  delete from public.follows where follower_id in (uid_a, uid_b) or followee_id in (uid_a, uid_b);
  delete from public.feed_events where user_id in (uid_a, uid_b);
  delete from public.profiles where user_id in (uid_a, uid_b);

  raise notice 'RLS drift repair self-test passed.';
end;
$$;
