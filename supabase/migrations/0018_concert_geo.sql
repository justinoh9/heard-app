-- Concert geo: venue coordinates, powering the live-music map view.
-- Run AFTER 0001–0017 on a project with Supabase Auth enabled.
--
-- Both columns are NULLABLE on purpose: every existing show predates venue
-- geocoding and stays perfectly valid without coordinates (it just doesn't
-- appear as a dot on the map). Nothing to backfill.

alter table public.concerts
  add column if not exists lat double precision,
  add column if not exists lng double precision;

-- Guard against a geocoder handing back garbage (or a swapped lat/lng pair,
-- the classic bug — a longitude of 122 can never be a latitude).
alter table public.concerts drop constraint if exists concerts_lat_range_check;
alter table public.concerts
  add constraint concerts_lat_range_check
  check (lat is null or (lat >= -90 and lat <= 90));

alter table public.concerts drop constraint if exists concerts_lng_range_check;
alter table public.concerts
  add constraint concerts_lng_range_check
  check (lng is null or (lng >= -180 and lng <= 180));

-- The map reads "my attended shows that have coordinates" — the partial index
-- skips the (many) rows with no geocode at all.
create index if not exists concerts_geo_idx
  on public.concerts (user_id)
  where lat is not null and lng is not null;

-- No policy changes: 0007/0008 already scope insert/update/delete to the owner
-- and 0017 added the owner-update policy these columns ride on.
