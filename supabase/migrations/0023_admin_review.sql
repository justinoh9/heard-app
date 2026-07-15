-- Admin report review (ROADMAP Phase 4 — moderation & safety).
-- Run AFTER 0001–0022 on a project with Supabase Auth enabled.
--
-- 0019 shipped reporting and said reports would be "triaged by hand in the SQL
-- editor for now". That is fine for zero reports and untenable at ten: it means
-- moderation only happens when someone remembers to go looking, and there is no
-- record of who decided what.
--
-- WHO IS AN ADMIN: a row in public.admins. Deliberately its own table rather than
-- a profiles.is_admin flag, for two reasons. profiles is PUBLIC READ, so a flag
-- there would publish the list of moderators to anyone with curl — an invitation
-- to target them. And a flag on a table users can update themselves is one bad
-- policy away from self-promotion.
--
-- There is NO client-facing insert/update/delete policy on public.admins. Admins
-- are made in the SQL editor with the service role, full stop. An API path to
-- granting admin is a privilege-escalation surface with no upside: this is a
-- once-a-year action performed by the person who owns the database.
--
-- WHAT AN ADMIN CANNOT DO HERE: ban or delete a user. Supabase's dashboard
-- already does that safely, and building an RPC that mutates auth.users would put
-- the heaviest action in the app behind a check I wrote this afternoon. The
-- dashboard is the right tool; this surface is for triage and content removal.

-- ============================================================
-- admins
-- ============================================================
create table if not exists public.admins (
  user_id    text primary key,
  note       text,                       -- who this is, so the table is readable in a year
  created_at timestamptz not null default now()
);

alter table public.admins enable row level security;

-- ============================================================
-- is_admin()
-- ============================================================
-- Defined before the policy that calls it, which is not merely tidiness: a
-- policy body is parsed at CREATE POLICY time, so the function has to exist first.
--
-- SECURITY DEFINER is what stops infinite recursion. The policy on public.admins
-- needs to read public.admins to decide whether you may read public.admins; a
-- naive `using (exists (select 1 from public.admins where ...))` re-enters its own
-- policy forever. A definer function reads the table WITHOUT re-entering RLS,
-- which breaks the cycle. STABLE lets the planner call it once per query rather
-- than once per row.
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.admins where user_id = auth.uid()::text
  );
$$;

-- Every signed-in client calls this (the UI asks "am I an admin?"). It answers
-- only about the caller, so it is safe to expose; anon has no uid, so it is
-- always false for them and there is nothing to gain by calling it.
revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated, anon;

-- Admins can see the admin list; nobody else learns it exists.
drop policy if exists "admins read admins" on public.admins;
create policy "admins read admins" on public.admins for select
  using (public.is_admin());

-- ============================================================
-- Review workflow columns
-- ============================================================
alter table public.reports add column if not exists reviewed_by text;
alter table public.reports add column if not exists reviewed_at timestamptz;

-- ============================================================
-- Reports: admins read all, and may move status
-- ============================================================
-- 0019 gave reports a private read (reporter only) and no update at all. Both
-- need widening for exactly one role.
drop policy if exists "admins read all reports" on public.reports;
create policy "admins read all reports" on public.reports for select
  using (public.is_admin());

drop policy if exists "admins review reports" on public.reports;
create policy "admins review reports" on public.reports for update
  using (public.is_admin())
  with check (public.is_admin());

-- RLS decides WHICH ROWS you may update; it cannot say WHICH COLUMNS. Without
-- this, an admin resolving a report could also rewrite its reason or note —
-- editing the evidence. Column privileges are the tool for that: take UPDATE
-- away wholesale, hand back only `status`. The reviewed_by/reviewed_at stamps
-- below are written by a trigger, which needs no grant of its own.
revoke update on public.reports from anon, authenticated;
grant update (status) on public.reports to authenticated;

-- ============================================================
-- Who reviewed it, and when — stamped, not self-reported
-- ============================================================
-- The client only sends `status`. The identity of the reviewer is taken from the
-- JWT rather than the request body, so it cannot be forged, and an admin cannot
-- quietly resolve reports under someone else's name.
create or replace function public.stamp_report_review()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status is distinct from old.status then
    new.reviewed_by := auth.uid()::text;
    new.reviewed_at := now();
  end if;
  return new;
end;
$$;

revoke all on function public.stamp_report_review() from public, anon, authenticated;

drop trigger if exists reports_stamp_review on public.reports;
create trigger reports_stamp_review
  before update on public.reports
  for each row execute function public.stamp_report_review();

-- ============================================================
-- Content removal
-- ============================================================
-- The point of triage is being able to act. Admins may delete the two surfaces
-- that carry free text and therefore carry abuse: comments and feed events.
-- (0008's "delete own X" policies still apply — permissive policies OR together,
-- so this adds a capability rather than replacing one.)
--
-- Ratings and concerts are deliberately not included: a rating is a number, and
-- removing someone's honest 7/10 is not moderation. If a concert's free-text
-- notes are ever abused, add it here then.
drop policy if exists "admins delete any comment" on public.comments;
create policy "admins delete any comment" on public.comments for delete
  using (public.is_admin());

drop policy if exists "admins delete any feed event" on public.feed_events;
create policy "admins delete any feed event" on public.feed_events for delete
  using (public.is_admin());

-- ============================================================
-- SELF-TEST — see 0021 for why these exist.
--
-- This one runs part of itself as the `authenticated` role rather than as the
-- table owner, because the whole feature IS an RLS boundary and the owner
-- bypasses RLS. Testing it as postgres would assert nothing at all.
-- ============================================================
do $$
declare
  admin_uid text := '00000000-0000-0000-0000-00000000ad11';
  user_uid  text := '00000000-0000-0000-0000-00000000c001';
  other_uid text := '00000000-0000-0000-0000-00000000c002';
  r_own  uuid := '00000000-0000-0000-0000-00000000f001';
  r_other uuid := '00000000-0000-0000-0000-00000000f002';
  n int;
  got text;
  edited boolean;
begin
  perform set_config('request.jwt.claims', '', true);

  insert into public.admins (user_id, note) values (admin_uid, 'self-test probe');
  insert into public.reports (id, reporter_id, target_type, target_id, target_user_id, reason)
    values (r_own,   user_uid,  'comment', 'probe-c1', other_uid, 'spam');
  insert into public.reports (id, reporter_id, target_type, target_id, target_user_id, reason)
    values (r_other, other_uid, 'comment', 'probe-c2', user_uid,  'harassment');

  -- ---- is_admin() ------------------------------------------------------
  perform set_config('request.jwt.claims', json_build_object('sub', user_uid)::text, true);
  if public.is_admin() then
    raise exception 'SELF-TEST FAILED: is_admin() true for a normal user';
  end if;

  perform set_config('request.jwt.claims', json_build_object('sub', admin_uid)::text, true);
  if not public.is_admin() then
    raise exception 'SELF-TEST FAILED: is_admin() false for an admin';
  end if;

  -- ---- RLS: a normal user sees only their own report --------------------
  set local role authenticated;
  perform set_config('request.jwt.claims', json_build_object('sub', user_uid)::text, true);
  select count(*) into n from public.reports;
  if n <> 1 then
    raise exception 'SELF-TEST FAILED: a normal user can see % reports, expected only their own 1', n;
  end if;

  -- ---- RLS: an admin sees both ----------------------------------------
  perform set_config('request.jwt.claims', json_build_object('sub', admin_uid)::text, true);
  select count(*) into n from public.reports;
  if n < 2 then
    raise exception 'SELF-TEST FAILED: an admin can see only % reports, expected all', n;
  end if;

  -- ---- RLS: a normal user cannot resolve a report ----------------------
  perform set_config('request.jwt.claims', json_build_object('sub', user_uid)::text, true);
  update public.reports set status = 'dismissed' where id = r_own;
  if found then
    raise exception 'SELF-TEST FAILED: a normal user resolved their own report';
  end if;

  -- ---- An admin can, and gets stamped ---------------------------------
  perform set_config('request.jwt.claims', json_build_object('sub', admin_uid)::text, true);
  update public.reports set status = 'actioned' where id = r_own;

  -- ---- ...but cannot edit the evidence --------------------------------
  -- The column grant, not RLS, is what stops this. Asserting it here because a
  -- future `grant update on public.reports to authenticated` would silently undo
  -- the protection and nothing else would notice.
  edited := false;
  begin
    update public.reports set reason = 'other' where id = r_own;
    edited := true;
  exception when insufficient_privilege then
    null;  -- expected
  end;
  if edited then
    raise exception 'SELF-TEST FAILED: an admin rewrote a report''s reason; UPDATE must be granted on (status) only';
  end if;

  reset role;

  select reviewed_by into got from public.reports where id = r_own;
  if got is distinct from admin_uid then
    raise exception 'SELF-TEST FAILED: reviewed_by was % , expected the acting admin', got;
  end if;
  select status into got from public.reports where id = r_own;
  if got <> 'actioned' then
    raise exception 'SELF-TEST FAILED: status did not move (got %)', got;
  end if;
  if (select reviewed_at from public.reports where id = r_own) is null then
    raise exception 'SELF-TEST FAILED: reviewed_at was not stamped';
  end if;

  delete from public.reports where id in (r_own, r_other);
  delete from public.admins  where user_id = admin_uid;

  raise notice 'Admin review self-test passed.';
end;
$$;
