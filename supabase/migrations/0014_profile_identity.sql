-- Profile identity basics (ROADMAP Phase 2 / G4). A Letterboxd profile is a
-- personal artifact — give it a unique @handle, a short bio, and (later) an
-- avatar. Handles also give share cards / deep links a stable URL.
--
-- All three columns are nullable (existing profiles keep rendering with just a
-- display name + initials). `handle` is unique case-insensitively so @Maya and
-- @maya can't both exist. `avatar_url` ships now so avatars can land later
-- without another migration (image upload → Supabase Storage is the follow-up).
-- Owner-write is already covered by the 0007 "update own profile" policy. Run
-- AFTER 0013.

alter table public.profiles add column if not exists handle     text;
alter table public.profiles add column if not exists bio        text;
alter table public.profiles add column if not exists avatar_url text;

-- Case-insensitive uniqueness (nulls allowed — a handle is optional).
create unique index if not exists profiles_handle_lower_idx
  on public.profiles (lower(handle));
