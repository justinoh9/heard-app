-- Comment paging indexes (ROADMAP Phase 4 — "scale the reads").
-- Run AFTER 0001–0025.
--
-- The item page now fetches 20 TOP-LEVEL comments and then their replies, rather
-- than every comment ever posted on an item (see SupabaseCommentsBackend
-- .listForItem for why paging roots and not rows is the only correct way to page
-- a threaded list). That's two new access patterns, and neither is served well by
-- 0001's `comments_item_idx (item_type, item_id, created_at desc)`:
--
--   1. "the newest 20 roots for this item" — 0001's index has no idea which rows
--      are roots, so Postgres reads every comment on the item and discards the
--      replies. On a popular item that is most of them.
--   2. "every reply whose parent is one of these 20" — 0016 added parent_id with
--      no index at all, so this is a sequential scan of the comments table, once
--      per page. Paging would have made the page *slower*.

-- Roots only: a partial index that is exactly the first query. Partial keeps it
-- small (replies are excluded entirely) and lets the planner walk it in
-- created_at order and stop after 21 rows.
create index if not exists comments_item_roots_idx
  on public.comments (item_type, item_id, created_at desc)
  where parent_id is null;

-- The reply lookup. Partial for the mirror-image reason: root comments have a
-- null parent_id and would be dead weight in an index that only ever answers
-- `parent_id in (...)`.
create index if not exists comments_parent_idx
  on public.comments (parent_id, created_at)
  where parent_id is not null;

-- ---------------------------------------------------------------------------
-- SELF-TEST — see 0021 for why these exist.
--
-- Asserts the *paging contract* the client depends on: that a page of roots plus
-- their replies never yields a reply whose parent is missing. buildThreads drops
-- orphan replies by design, so violating this loses comments silently.
-- ---------------------------------------------------------------------------
do $$
declare
  root_a uuid := '00000000-0000-0000-0000-00000000aa01';
  root_b uuid := '00000000-0000-0000-0000-00000000aa02';
  n int;
  orphans int;
begin
  perform set_config('request.jwt.claims', '', true);

  insert into public.comments (id, item_id, item_type, item_title, item_artist, user_id, display_name, body, created_at)
    values
      (root_a, 'probe-item', 'song', 'Probe', 'Probe', '00000000-0000-0000-0000-0000000d0001', 'A', 'root a', now() - interval '2 min'),
      (root_b, 'probe-item', 'song', 'Probe', 'Probe', '00000000-0000-0000-0000-0000000d0002', 'B', 'root b', now() - interval '1 min');

  insert into public.comments (item_id, item_type, item_title, item_artist, user_id, display_name, body, parent_id)
    values
      ('probe-item', 'song', 'Probe', 'Probe', '00000000-0000-0000-0000-0000000d0003', 'C', 'reply to a', root_a),
      ('probe-item', 'song', 'Probe', 'Probe', '00000000-0000-0000-0000-0000000d0004', 'D', 'reply to b', root_b);

  -- Only roots are counted as pageable units — 4 comments exist, 2 are roots.
  select count(*) into n
    from public.comments
   where item_id = 'probe-item' and item_type = 'song' and parent_id is null;
  if n <> 2 then
    raise exception 'SELF-TEST FAILED: expected 2 root comments, found %', n;
  end if;

  -- A page of ONE root (the newest, root_b) plus its replies must contain no
  -- reply belonging to root_a. If it did, the client would render a reply under a
  -- parent it never fetched — or, given buildThreads, drop it on the floor.
  with page_roots as (
    select id from public.comments
     where item_id = 'probe-item' and item_type = 'song' and parent_id is null
     order by created_at desc
     limit 1
  ),
  page as (
    select id, parent_id from public.comments where id in (select id from page_roots)
    union all
    select id, parent_id from public.comments where parent_id in (select id from page_roots)
  )
  select count(*) into orphans
    from page p
   where p.parent_id is not null
     and p.parent_id not in (select id from page where parent_id is null);
  if orphans <> 0 then
    raise exception 'SELF-TEST FAILED: a page contained % replies with no parent in it', orphans;
  end if;

  -- And that page must be exactly root_b + its one reply.
  with page_roots as (
    select id from public.comments
     where item_id = 'probe-item' and item_type = 'song' and parent_id is null
     order by created_at desc
     limit 1
  )
  select count(*) into n
    from public.comments
   where id in (select id from page_roots)
      or parent_id in (select id from page_roots);
  if n <> 2 then
    raise exception 'SELF-TEST FAILED: a 1-root page returned % rows, expected the root + its 1 reply', n;
  end if;

  delete from public.comments where item_id = 'probe-item';

  raise notice 'Comment paging self-test passed.';
end;
$$;
