-- Profile search indexes (ROADMAP Phase 4 — "scale the reads").
-- Run AFTER 0001–0024.
--
-- The People directory now searches and pages in the database rather than
-- fetching every profile (SupabaseSocialBackend.searchProfiles). Search without
-- an index is a sequential scan of the whole table on every keystroke, which is
-- the same amount of work we just stopped doing — moved from the network to the
-- database, where it's harder to notice.
--
-- WHY TRIGRAM AND NOT A PLAIN B-TREE:
-- The query is `display_name ilike '%maya%'` — a leading wildcard, because people
-- search for a fragment, not a prefix. A B-tree on lower(display_name) can serve
-- 'maya%' and is useless for '%maya%'. pg_trgm indexes three-character shingles,
-- which is exactly what an unanchored ILIKE needs. It ships with Supabase.

create extension if not exists pg_trgm;

create index if not exists profiles_display_name_trgm_idx
  on public.profiles using gin (display_name gin_trgm_ops);

-- Handles are searched by the same box, in the same query. Partial because a
-- handle is optional (0014 added it nullable) and there's no reason to index the
-- nulls.
create index if not exists profiles_handle_trgm_idx
  on public.profiles using gin (handle gin_trgm_ops)
  where handle is not null;

-- The unsearched path — the plain directory — orders by display_name and pages
-- with LIMIT/OFFSET. A GIN trigram index can't serve an ORDER BY, so this one
-- keeps the common "no query typed" case off a sort of the entire table.
create index if not exists profiles_display_name_idx
  on public.profiles (display_name);

-- ---------------------------------------------------------------------------
-- SELF-TEST — see 0021 for why these exist.
--
-- Asserts the search *finds the right people*, which is the part that would
-- otherwise be discovered by a user typing their friend's name and getting
-- nothing back. It does not assert that the planner chooses the index: on the
-- handful of rows this runs against it correctly won't, and forcing the issue
-- would test the fixture rather than the schema.
-- ---------------------------------------------------------------------------
do $$
declare
  n int;
  got text;
begin
  perform set_config('request.jwt.claims', '', true);

  -- The probe names are deliberately unpronounceable rather than the obvious
  -- 'Maya Probe' / 'Devon Probe'. This test asserts exact match COUNTS, and a
  -- real directory already contains a Maya and a Devon — so friendly probe names
  -- would collide with live rows and fail an assertion about the schema for
  -- reasons that have nothing to do with the schema. A self-test runs against
  -- production data; it must only ever see its own.
  insert into public.profiles (user_id, display_name, handle) values
    ('00000000-0000-0000-0000-0000000e0001', 'Zqxprobe Alpha', 'zqxalpha'),
    ('00000000-0000-0000-0000-0000000e0002', 'Zqxprobe Beta',  'zqxbeta'),
    ('00000000-0000-0000-0000-0000000e0003', 'Zqxprobe Gamma', null);

  -- A fragment from the MIDDLE of a name must match — the leading-wildcard case
  -- the trigram index exists for, and the one a B-tree cannot serve.
  select count(*) into n from public.profiles where display_name ilike '%qxprobe Al%';
  if n <> 1 then
    raise exception 'SELF-TEST FAILED: infix name search matched % rows, expected 1', n;
  end if;

  -- Case-insensitively, since people type lowercase.
  select display_name into got from public.profiles where display_name ilike '%ZQXPROBE ALPHA%';
  if got is distinct from 'Zqxprobe Alpha' then
    raise exception 'SELF-TEST FAILED: case-insensitive search returned %', got;
  end if;

  -- Handle search. The third probe's handle is null: it must neither error nor
  -- match, just be absent.
  select count(*) into n from public.profiles where handle ilike '%zqxbeta%';
  if n <> 1 then
    raise exception 'SELF-TEST FAILED: handle search matched % rows, expected 1', n;
  end if;

  -- The shared name finds all three: paging exists because searches match many.
  select count(*) into n from public.profiles where display_name ilike '%Zqxprobe%';
  if n <> 3 then
    raise exception 'SELF-TEST FAILED: shared-name search matched % rows, expected 3', n;
  end if;

  delete from public.profiles where user_id like '00000000-0000-0000-0000-0000000e%';

  raise notice 'Profile search self-test passed.';
end;
$$;
