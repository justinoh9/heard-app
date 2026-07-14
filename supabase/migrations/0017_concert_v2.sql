-- Concert layer v2: a "want to go" wishlist + a real tag-confirmation flow.
-- Run AFTER 0001–0016 on a project with Supabase Auth enabled.
--
-- The map view + venue geocoding (lat/lng) are a separate follow-up — they
-- need a maps dependency decision — so this migration is data + policy only.

-- ---- concerts.status: attended (the log flow) vs wishlist (want to go) ----
-- Existing rows are attended shows, so the NOT NULL DEFAULT backfills them
-- correctly with no extra step.
alter table public.concerts
  add column if not exists status text not null default 'attended'
  check (status in ('attended', 'wishlist'));

create index if not exists concerts_status_idx on public.concerts (user_id, status);

-- The owner can edit their own show — flip a wishlist entry to attended, fix a
-- field. (Insert/delete already scoped to the owner in 0007/0008.)
drop policy if exists "update own concert" on public.concerts;
create policy "update own concert" on public.concerts for update
  using (auth.uid()::text = user_id)
  with check (auth.uid()::text = user_id);

-- ---- concert_tags.status: pending until the tagged user confirms ----
-- Add nullable, backfill EXISTING tags as 'confirmed' (they were applied
-- immediately under the old behavior — don't retroactively hide them), THEN
-- set the default so only NEW tags start 'pending'.
alter table public.concert_tags add column if not exists status text;
update public.concert_tags set status = 'confirmed' where status is null;
alter table public.concert_tags alter column status set default 'pending';
alter table public.concert_tags alter column status set not null;
alter table public.concert_tags drop constraint if exists concert_tags_status_check;
alter table public.concert_tags
  add constraint concert_tags_status_check check (status in ('pending', 'confirmed'));

-- The tagged user confirms their own tag (pending -> confirmed); the concert's
-- owner may also update tags on their show. Declining is the existing
-- self-untag delete policy from 0008 (untag self or own concert).
drop policy if exists "confirm own tag" on public.concert_tags;
create policy "confirm own tag" on public.concert_tags for update
  using (
    auth.uid()::text = user_id
    or auth.uid()::text = (select user_id from public.concerts where id = concert_id)
  )
  with check (
    auth.uid()::text = user_id
    or auth.uid()::text = (select user_id from public.concerts where id = concert_id)
  );
