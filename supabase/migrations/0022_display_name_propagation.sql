-- Display-name propagation (ROADMAP Phase 4).
-- Run AFTER 0001–0021 on a project with Supabase Auth enabled.
--
-- THE BUG: display names are denormalized at write time — feed_events.display_name
-- and comments.display_name are snapshots taken when the row was created (0001
-- even says so in a comment: "doesn't update if the user renames later"). Change
-- your name and your whole history keeps the old one. Since 0014 gave everyone an
-- editable handle and bio, the Edit profile screen invites exactly the rename that
-- breaks this.
--
-- WHY NOT JUST JOIN THROUGH profiles AND DELETE THE COLUMNS:
-- That is the tidier schema, and it's what the roadmap floated. Two things argue
-- against it. The denormalization is deliberate — 0004 calls it "denormalized for
-- one-query feeds", and the feed is the app's hottest read; a join would tax every
-- feed load forever to fix a problem that occurs when somebody renames. And more
-- decisively, PostgREST can only embed a related table through a real foreign key,
-- which these columns do not have and cannot easily get: rows written under the old
-- LocalAuthBackend ids are orphaned (documented in CLAUDE.md), so adding
-- `references public.profiles` would fail validation until someone did data surgery
-- on live rows.
--
-- So: keep the fast read, and pay on the rare write. A rename is O(your rows) and
-- happens approximately never; a feed read happens constantly.
--
-- WHY SECURITY DEFINER: propagating your new name means writing rows you do not
-- own. A repost of your content lives on the REPOSTER's feed_events row, and its
-- payload carries your name as attribution. You have no policy that lets you
-- update someone else's row — nor should you — so the trigger has to run as owner.
-- Same posture as 0020/0021: no caller arguments, empty search_path, everything
-- schema-qualified.

create or replace function public.propagate_display_name()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  touched int;
begin
  -- profiles rows are also updated for bio/avatar/handle/favorites; only a real
  -- name change should trigger the sweep.
  if new.display_name is not distinct from old.display_name then
    return new;
  end if;

  update public.feed_events
     set display_name = new.display_name
   where user_id = new.user_id
     and display_name is distinct from new.display_name;

  update public.comments
     set display_name = new.display_name
   where user_id = new.user_id
     and display_name is distinct from new.display_name;

  -- Reposts denormalize the ORIGINAL author's name into the reposter's payload
  -- (see toDisplayEvent in src/social/feed-rows.ts, which reads
  -- payload.originalDisplayName). Those rows belong to other people.
  update public.feed_events
     set payload = jsonb_set(payload, '{originalDisplayName}', to_jsonb(new.display_name))
   where type = 'repost'
     and payload ->> 'originalUserId' = new.user_id
     and payload ->> 'originalDisplayName' is distinct from new.display_name;

  return new;
end;
$$;

revoke all on function public.propagate_display_name() from public, anon, authenticated;

drop trigger if exists profiles_propagate_display_name on public.profiles;
create trigger profiles_propagate_display_name
  after update on public.profiles
  for each row execute function public.propagate_display_name();

-- ---------------------------------------------------------------------------
-- One-time backfill for names that already drifted. Everything the trigger will
-- keep in sync from now on, but for history written before it existed.
-- ---------------------------------------------------------------------------
update public.feed_events fe
   set display_name = p.display_name
  from public.profiles p
 where p.user_id = fe.user_id
   and fe.display_name is distinct from p.display_name;

update public.comments c
   set display_name = p.display_name
  from public.profiles p
 where p.user_id = c.user_id
   and c.display_name is distinct from p.display_name;

update public.feed_events fe
   set payload = jsonb_set(fe.payload, '{originalDisplayName}', to_jsonb(p.display_name))
  from public.profiles p
 where fe.type = 'repost'
   and fe.payload ->> 'originalUserId' = p.user_id
   and fe.payload ->> 'originalDisplayName' is distinct from p.display_name;

-- ---------------------------------------------------------------------------
-- SELF-TEST — see 0021 for why these exist.
--
-- Uses fabricated ids that match no real account and cleans up after itself. The
-- rate limiters from 0021 are bypassed here because this block runs with no JWT
-- (auth.uid() is null → service-role path), which the explicit set_config below
-- guarantees even if a previous statement in the same session set one.
-- ---------------------------------------------------------------------------
do $$
declare
  uid_a text := '00000000-0000-0000-0000-0000000000a1';  -- gets renamed
  uid_b text := '00000000-0000-0000-0000-0000000000b1';  -- reposts uid_a
  got text;
begin
  perform set_config('request.jwt.claims', '', true);

  insert into public.profiles (user_id, display_name) values (uid_a, 'Old Name');
  insert into public.profiles (user_id, display_name) values (uid_b, 'Someone Else');

  insert into public.feed_events (user_id, display_name, type, payload)
    values (uid_a, 'Old Name', 'rated', '{}'::jsonb);

  insert into public.comments (item_id, item_type, item_title, item_artist, user_id, display_name, body)
    values ('probe-item', 'song', 'Probe', 'Probe Artist', uid_a, 'Old Name', 'probe comment');

  -- uid_b reposts uid_a's content: the attribution lives on uid_b's row.
  insert into public.feed_events (user_id, display_name, type, payload)
    values (
      uid_b, 'Someone Else', 'repost',
      jsonb_build_object('originalUserId', uid_a, 'originalDisplayName', 'Old Name', 'note', 'nice')
    );

  -- The rename.
  update public.profiles set display_name = 'New Name' where user_id = uid_a;

  select display_name into got from public.feed_events where user_id = uid_a and type = 'rated';
  if got is distinct from 'New Name' then
    raise exception 'SELF-TEST FAILED: feed_events.display_name did not propagate (got %)', got;
  end if;

  select display_name into got from public.comments where user_id = uid_a;
  if got is distinct from 'New Name' then
    raise exception 'SELF-TEST FAILED: comments.display_name did not propagate (got %)', got;
  end if;

  select payload ->> 'originalDisplayName' into got
    from public.feed_events where user_id = uid_b and type = 'repost';
  if got is distinct from 'New Name' then
    raise exception 'SELF-TEST FAILED: repost attribution did not propagate (got %)', got;
  end if;

  -- The reposter's own name must NOT have been rewritten — only the attribution.
  select display_name into got from public.feed_events where user_id = uid_b and type = 'repost';
  if got is distinct from 'Someone Else' then
    raise exception 'SELF-TEST FAILED: the rename leaked onto another user''s row (got %)', got;
  end if;

  -- The rest of the payload must survive jsonb_set.
  select payload ->> 'note' into got from public.feed_events where user_id = uid_b and type = 'repost';
  if got is distinct from 'nice' then
    raise exception 'SELF-TEST FAILED: jsonb_set clobbered the rest of the payload (note = %)', got;
  end if;

  delete from public.comments    where user_id in (uid_a, uid_b);
  delete from public.feed_events where user_id in (uid_a, uid_b);
  delete from public.profiles    where user_id in (uid_a, uid_b);

  raise notice 'Display-name propagation self-test passed.';
end;
$$;
