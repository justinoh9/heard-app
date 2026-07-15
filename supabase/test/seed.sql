-- Realistic-ish data for the harness's SECOND pass.
--
-- WHY THIS EXISTS: the first version of this harness applied every migration to
-- an EMPTY database and reported green. Then 0024 failed on the real project,
-- because its self-test capped browse sections to 1 to prove a point and a
-- genuine album with a better average correctly beat the probe out of the slot.
-- The migration was right; the test was only ever true of an empty world. 0025
-- had the same disease and would have failed next: it counted rows matching
-- '%MAYA%' and the real directory has a Maya in it.
--
-- A self-test runs against production data. So the harness has to run the
-- migrations twice: once clean, and once against a database that already has
-- people, items, ratings and comments in it — including names and genres that
-- deliberately collide with the kind of probe values a self-test might pick.
-- Any assertion that isn't scoped to its own rows dies on the second pass, which
-- is the only place it can die cheaply.

-- Two profiles whose names overlap the obvious probe vocabulary.
insert into public.profiles (user_id, display_name, handle) values
  ('11111111-1111-1111-1111-111111111001', 'Maya',        'maya'),
  ('11111111-1111-1111-1111-111111111002', 'Devon Probe', 'devon'),
  ('11111111-1111-1111-1111-111111111003', 'Priya',       'priya')
on conflict (user_id) do nothing;

-- A near-perfect album, so anything that assumes the probe tops "Top rated"
-- breaks here rather than in production.
insert into public.items (id, type, title, artist, release_year, genres) values
  ('seed-masterpiece', 'album', 'Seeded Masterpiece', 'Seed Artist', 2020, array['Rock']),
  ('seed-popular',     'album', 'Seeded Popular',     'Seed Artist', 2024, array['Pop']),
  ('seed-probe-ish',   'album', 'Seeded Probe Rock',  'Seed Artist', 1999, array['Probe Rock'])
on conflict (id) do nothing;

insert into public.ratings (user_id, item_id, score, created_at) values
  ('11111111-1111-1111-1111-111111111001', 'seed-masterpiece', 10.0, now() - interval '2 days'),
  ('11111111-1111-1111-1111-111111111002', 'seed-masterpiece', 10.0, now() - interval '1 day'),
  ('11111111-1111-1111-1111-111111111003', 'seed-masterpiece',  9.9, now()),
  ('11111111-1111-1111-1111-111111111001', 'seed-popular',      8.0, now()),
  ('11111111-1111-1111-1111-111111111002', 'seed-popular',      7.0, now()),
  -- A real item carrying a genre a lazy probe might also use.
  ('11111111-1111-1111-1111-111111111003', 'seed-probe-ish',    6.0, now())
on conflict (user_id, item_id) do nothing;

insert into public.comments (item_id, item_type, item_title, item_artist, user_id, display_name, body)
select
  'seed-masterpiece', 'album', 'Seeded Masterpiece', 'Seed Artist',
  '11111111-1111-1111-1111-111111111001', 'Maya', 'seeded comment ' || i
from generate_series(1, 3) as g(i);

insert into public.follows (follower_id, followee_id) values
  ('11111111-1111-1111-1111-111111111001', '11111111-1111-1111-1111-111111111002')
on conflict do nothing;

-- Real accounts, so pass 2 exercises the funnel against a non-empty cohort
-- (analytics_funnel reads auth.users.created_at rather than an events table).
insert into auth.users (id, instance_id, aud, role, email, created_at) values
  ('11111111-1111-1111-1111-111111111001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'maya@seed.invalid',  now() - interval '20 days'),
  ('11111111-1111-1111-1111-111111111002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'devon@seed.invalid', now() - interval '10 days'),
  ('11111111-1111-1111-1111-111111111003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'priya@seed.invalid', now() - interval '400 days')
on conflict (id) do nothing;
