-- Heard — DEV SEED DATA (not schema). Populates a few demo users with profiles,
-- ratings, and activity so the app's social surfaces look alive.
--
-- Safe to run more than once: every row has a fixed id and ON CONFLICT DO NOTHING.
-- These are NOT real accounts — you can't log in as them (auth is separate). To
-- see their activity in your feed: sign in, open People / "Find friends", and
-- follow them (the feed is "events by you + people you follow").
--
-- Remove all of it later with:
--   delete from public.feed_events where user_id in
--     ('11111111-1111-1111-1111-111111111111','22222222-2222-2222-2222-222222222222','33333333-3333-3333-3333-333333333333');
--   delete from public.ratings   where user_id in (...same three...);
--   delete from public.concerts  where user_id in (...same three...);
--   delete from public.profiles  where user_id in (...same three...);

-- ---------- shared item catalog (albums the seed users rated) ----------
-- art_url null where a real Spotify cover isn't known (AlbumCover shows a
-- placeholder); only Currents uses a verified cover URL.
insert into public.items (id, type, title, artist, art_url) values
  ('seed-sos',      'album', 'SOS',                     'SZA',                null),
  ('seed-igor',     'album', 'IGOR',                    'Tyler, The Creator', null),
  ('seed-currents', 'album', 'Currents',                'Tame Impala',        'https://i.scdn.co/image/ab67616d00001e029e1cfc756886ac782e363d79'),
  ('seed-blonde',   'album', 'Blonde',                  'Frank Ocean',        null),
  ('seed-gkmc',     'album', 'good kid, m.A.A.d city',  'Kendrick Lamar',     null)
on conflict (id) do nothing;

-- ---------- profiles (the people directory) ----------
insert into public.profiles (user_id, display_name, favorites) values
  ('11111111-1111-1111-1111-111111111111', 'Maya',  array['seed-sos','seed-blonde']),
  ('22222222-2222-2222-2222-222222222222', 'Devon', array['seed-igor','seed-gkmc']),
  ('33333333-3333-3333-3333-333333333333', 'Priya', array['seed-currents'])
on conflict (user_id) do nothing;

-- ---------- ratings (their ranked lists) ----------
insert into public.ratings (id, user_id, item_id, score, tiebreak, created_at) values
  ('a1111111-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'seed-sos',      8.8, 0, now() - interval '5 days'),
  ('a1111111-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', 'seed-blonde',   9.4, 0, now() - interval '4 days'),
  ('a2222222-0000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222', 'seed-igor',     9.2, 0, now() - interval '6 days'),
  ('a2222222-0000-0000-0000-000000000002', '22222222-2222-2222-2222-222222222222', 'seed-gkmc',     9.7, 0, now() - interval '3 days'),
  ('a3333333-0000-0000-0000-000000000001', '33333333-3333-3333-3333-333333333333', 'seed-currents', 8.1, 0, now() - interval '2 days')
on conflict (id) do nothing;

-- ---------- feed_events (the activity that fills the feed) ----------
insert into public.feed_events (id, user_id, display_name, type, payload, created_at) values
  ('f1111111-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'Maya', 'rated',
     '{"itemId":"seed-sos","itemType":"album","title":"SOS","artist":"SZA","score":8.8}', now() - interval '5 hours'),
  ('f1111111-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', 'Maya', 'drop',
     '{"itemId":"seed-blonde","itemType":"album","title":"Blonde","artist":"Frank Ocean","caption":"rainy day rotation"}', now() - interval '3 hours'),
  ('f2222222-0000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222', 'Devon', 'rated',
     '{"itemId":"seed-gkmc","itemType":"album","title":"good kid, m.A.A.d city","artist":"Kendrick Lamar","score":9.7}', now() - interval '8 hours'),
  ('f2222222-0000-0000-0000-000000000002', '22222222-2222-2222-2222-222222222222', 'Devon', 'streak',
     '{"days":30}', now() - interval '6 hours'),
  ('f2222222-0000-0000-0000-000000000003', '22222222-2222-2222-2222-222222222222', 'Devon', 'concert',
     '{"title":"Tyler, The Creator","artist":"The Forum · Los Angeles","score":9.0}', now() - interval '2 days'),
  ('f3333333-0000-0000-0000-000000000001', '33333333-3333-3333-3333-333333333333', 'Priya', 'rated',
     '{"itemId":"seed-currents","itemType":"album","title":"Currents","artist":"Tame Impala","score":8.1,"artUrl":"https://i.scdn.co/image/ab67616d00001e029e1cfc756886ac782e363d79"}', now() - interval '1 hours')
on conflict (id) do nothing;

-- ---------- one concert row (Devon's show, matches the concert feed event) ----------
insert into public.concerts (id, user_id, artist_name, venue, city, show_date, score, notes) values
  ('c2222222-0000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222', 'Tyler, The Creator', 'The Forum', 'Los Angeles', current_date - 2, 9.0, 'call me if you get lost tour')
on conflict (id) do nothing;
