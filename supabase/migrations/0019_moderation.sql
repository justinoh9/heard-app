-- Moderation & safety (ROADMAP Phase 4): blocking and reporting.
-- Run AFTER 0001–0018 on a project with Supabase Auth enabled.
--
-- Posture note: every other table in this app is PUBLIC READ (guests browse
-- ratings, profiles, comments). These two are the deliberate exception —
-- who you blocked and what you reported are private to you. A blocked user
-- must not be able to discover that they were blocked, and a reported user
-- must not be able to discover who reported them; both would invite exactly
-- the retaliation the feature exists to prevent.

-- ============================================================
-- blocks
-- ============================================================
create table if not exists public.blocks (
  blocker_id text not null,
  blocked_id text not null,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);

-- "Who did I block" is the read the app makes on sign-in.
create index if not exists blocks_blocker_idx on public.blocks (blocker_id);
-- "Did X block me" is the read the tightened insert policies below make.
create index if not exists blocks_blocked_idx on public.blocks (blocked_id);

alter table public.blocks enable row level security;

-- Private: you only ever see your own block list. Note this is `for select`
-- scoped to the blocker only — the blocked party gets nothing back.
drop policy if exists "read own blocks" on public.blocks;
create policy "read own blocks" on public.blocks for select
  using (auth.uid()::text = blocker_id);

drop policy if exists "block as self" on public.blocks;
create policy "block as self" on public.blocks for insert
  with check (auth.uid()::text = blocker_id);

drop policy if exists "unblock as self" on public.blocks;
create policy "unblock as self" on public.blocks for delete
  using (auth.uid()::text = blocker_id);

-- ============================================================
-- reports
-- ============================================================
create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id text not null,
  -- What was reported. Kept as a loose text discriminator (same shape as
  -- likes.target_type) so a new reportable surface needs no migration.
  target_type text not null check (target_type in ('user', 'comment', 'rating', 'concert', 'feed_event')),
  target_id text not null,
  -- The author of the reported content, denormalized so a reviewer can see
  -- who is being reported without joining through five different tables.
  target_user_id text,
  reason text not null check (reason in ('spam', 'harassment', 'hate', 'sexual', 'violence', 'self_harm', 'other')),
  note text check (note is null or char_length(note) <= 1000),
  -- Review workflow. Triaged by hand in the SQL editor for now; there is no
  -- admin UI yet and this table is not readable by normal clients.
  status text not null default 'open' check (status in ('open', 'reviewed', 'actioned', 'dismissed')),
  created_at timestamptz not null default now(),
  -- One report per person per thing: re-reporting the same comment is noise,
  -- and it lets the client treat "already reported" as a successful no-op.
  unique (reporter_id, target_type, target_id)
);

create index if not exists reports_status_idx on public.reports (status, created_at desc);
create index if not exists reports_target_idx on public.reports (target_type, target_id);

alter table public.reports enable row level security;

-- You can see the reports you filed (so the UI can say "already reported"),
-- and nothing else. Reviewers read this table with the service role.
drop policy if exists "read own reports" on public.reports;
create policy "read own reports" on public.reports for select
  using (auth.uid()::text = reporter_id);

drop policy if exists "report as self" on public.reports;
create policy "report as self" on public.reports for insert
  with check (
    auth.uid()::text = reporter_id
    -- Reporting yourself is always a mistake or an attempt to pollute triage.
    and (target_user_id is null or target_user_id <> auth.uid()::text)
  );

-- Deliberately no update/delete policy: a report is an immutable record, and
-- letting a reporter withdraw one would let a harasser file-and-clear at will.

-- ============================================================
-- Make a block actually bite
-- ============================================================

-- Blocking has to sever the follow in BOTH directions, but 0007's delete policy
-- only lets you remove follows where you are the follower — so A could never
-- drop B's follow of A. This adds the missing "remove a follower" capability,
-- which is a reasonable power to have on its own.
drop policy if exists "remove own follower" on public.follows;
create policy "remove own follower" on public.follows for delete
  using (auth.uid()::text = followee_id);

-- Someone you blocked must not be able to follow you back. Replaces 0007's
-- "follow as self", keeping its ownership check and adding the block test.
drop policy if exists "follow as self" on public.follows;
create policy "follow as self" on public.follows for insert
  with check (
    auth.uid()::text = follower_id
    and not exists (
      select 1 from public.blocks
      where blocker_id = followee_id and blocked_id = auth.uid()::text
    )
  );

-- Nor tag you at a show. Replaces 0007's "owner tags attendees".
drop policy if exists "owner tags attendees" on public.concert_tags;
create policy "owner tags attendees" on public.concert_tags for insert
  with check (
    auth.uid()::text = (select user_id from public.concerts where id = concert_id)
    and not exists (
      select 1 from public.blocks
      where blocker_id = concert_tags.user_id and blocked_id = auth.uid()::text
    )
  );
