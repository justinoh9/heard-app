-- Restore the comments/likes write policies 0030 dropped — SECURITY/CORRECTNESS.
--
-- WHAT WENT WRONG. 0030 repaired RLS drift by dropping every legacy
-- "anyone can …" policy and re-asserting the intended one. For comments and
-- likes it did only the first half: it dropped `anyone can insert a comment`,
-- `anyone can insert a like`, and `anyone can delete a like`, but its section 2
-- re-asserts policies for eight OTHER tables and never mentions these two. The
-- assumption was that 0007's first two sections had already landed on
-- production, so the replacements were there. They were not.
--
-- RLS fails closed, so the result was a table with no write policy at all:
-- every unlike was silently refused, affecting zero rows. It surfaced as a
-- like count that would not go down — and only because the client had just
-- been taught (see src/likes/supabase-backend.ts) to report what a delete
-- ACTUALLY removed. The previous client decremented on faith, so this had been
-- invisible: the number moved, the row stayed, and a reload undid it.
--
-- WHY THE AUDIT MISSED IT. `anon_cannot_write` posts as anon and treats 42501
-- as "correctly refused". But 42501 is equally what a table with NO policy
-- returns, because RLS denies by default. The probe cannot distinguish
-- "hardened" from "bricked" — it only ever proved anon can't write, never that
-- the owner still can. That is the same mistake three times over now: a check
-- that is green for a reason other than the one it claims to test. The
-- self-test below is the fix, because it asserts BOTH directions.
--
-- Idempotent, like 0030: drop-then-create, so it converges from any state.
-- Run AFTER 0031.

-- ---- comments: insert only as yourself (0007's text) ------------------------
drop policy if exists "insert own comment" on public.comments;
create policy "insert own comment" on public.comments for insert
  with check (
    auth.uid()::text = user_id
    and char_length(trim(body)) > 0
    and char_length(body) <= 1000
    and item_type in ('song', 'album')
  );

-- ---- likes: insert/delete only your own (0007's text) -----------------------
drop policy if exists "insert own like" on public.likes;
create policy "insert own like" on public.likes for insert
  with check (auth.uid()::text = user_id and target_type in ('item', 'comment'));

drop policy if exists "delete own like" on public.likes;
create policy "delete own like" on public.likes for delete
  using (auth.uid()::text = user_id);

-- ---------------------------------------------------------------------------
-- Self-test. Asserts the owner CAN write and a non-owner CANNOT — both halves,
-- because asserting only the second is what let this ship. Runs as
-- `authenticated`/`anon`; the owner bypasses RLS and would pass vacuously.
-- ---------------------------------------------------------------------------
do $$
declare
  uid_a text := '00000000-0000-0000-0000-00000000e001';
  uid_b text := '00000000-0000-0000-0000-00000000e002';
  n int;
begin
  perform set_config('request.jwt.claims', '', true);
  insert into public.profiles (user_id, display_name)
    values (uid_a, 'Likes Probe A'), (uid_b, 'Likes Probe B');

  -- ---- the owner can like, and can unlike again ----------------------------
  perform set_config('request.jwt.claims', json_build_object('sub', uid_a)::text, true);
  set local role authenticated;
  insert into public.likes (target_type, target_id, user_id)
    values ('item', 'probe-item', uid_a);
  reset role;

  select count(*) into n from public.likes where user_id = uid_a;
  if n <> 1 then
    raise exception 'SELF-TEST FAILED: the owner could not like (got %)', n;
  end if;

  -- The regression: this delete silently removed nothing on production.
  set local role authenticated;
  delete from public.likes where target_type = 'item' and target_id = 'probe-item' and user_id = uid_a;
  reset role;

  select count(*) into n from public.likes where user_id = uid_a;
  if n <> 0 then
    raise exception 'SELF-TEST FAILED: the owner could not UNLIKE — no delete policy (got %)', n;
  end if;

  -- ---- but nobody can unlike somebody else's like --------------------------
  perform set_config('request.jwt.claims', '', true);
  insert into public.likes (target_type, target_id, user_id)
    values ('item', 'probe-item', uid_b);

  perform set_config('request.jwt.claims', json_build_object('sub', uid_a)::text, true);
  set local role authenticated;
  delete from public.likes where user_id = uid_b;
  reset role;

  select count(*) into n from public.likes where user_id = uid_b;
  if n <> 1 then
    raise exception 'SELF-TEST FAILED: a user deleted someone else''s like';
  end if;

  -- ---- and cannot like AS someone else -------------------------------------
  begin
    set local role authenticated;
    insert into public.likes (target_type, target_id, user_id)
      values ('item', 'probe-forged', uid_b);
    reset role;
    raise exception 'SELF-TEST FAILED: a user liked as another user';
  exception
    when insufficient_privilege then reset role;
  end;

  -- ---- comments: the owner can comment -------------------------------------
  set local role authenticated;
  insert into public.comments (user_id, display_name, item_id, item_type, item_title, item_artist, body)
    values (uid_a, 'Likes Probe A', 'probe-item', 'song', 'Probe Song', 'Probe Band', 'probe');
  reset role;

  select count(*) into n from public.comments where user_id = uid_a;
  if n <> 1 then
    raise exception 'SELF-TEST FAILED: the owner could not comment (got %)', n;
  end if;

  -- ---- …but not as someone else --------------------------------------------
  begin
    set local role authenticated;
    insert into public.comments (user_id, display_name, item_id, item_type, item_title, item_artist, body)
      values (uid_b, 'Likes Probe B', 'probe-item', 'song', 'Probe Song', 'Probe Band', 'forged');
    reset role;
    raise exception 'SELF-TEST FAILED: a user commented as another user';
  exception
    when insufficient_privilege then reset role;
  end;

  -- ---- anon can do neither --------------------------------------------------
  perform set_config('request.jwt.claims', '', true);
  begin
    set local role anon;
    insert into public.likes (target_type, target_id, user_id)
      values ('item', 'probe-item', uid_a);
    reset role;
    raise exception 'SELF-TEST FAILED: anon inserted a like';
  exception
    when insufficient_privilege then reset role;
  end;

  delete from public.comments where user_id in (uid_a, uid_b);
  delete from public.likes where user_id in (uid_a, uid_b);
  delete from public.profiles where user_id in (uid_a, uid_b);

  raise notice 'Likes/comments policy repair self-test passed.';
end;
$$;
