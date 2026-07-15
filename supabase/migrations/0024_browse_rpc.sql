-- Browse aggregation, server-side (ROADMAP Phase 4 — "scale the reads").
-- Run AFTER 0001–0023.
--
-- THE PROBLEM: SupabaseBrowseBackend.load() selected EVERY rating joined to its
-- item and tallied them in the browser. At 37 ratings that is invisible. It has
-- two failure modes past that, and the second is the nasty one:
--   1. It ships the entire ratings table to a phone to render twenty covers.
--   2. PostgREST caps rows per response. When the table crosses that cap the
--      query keeps succeeding — it just silently stops telling the truth, and
--      "Top rated" quietly becomes "top rated among an arbitrary subset". A wrong
--      answer that looks right is worse than an error.
--
-- Aggregating here collapses ratings → items in the database and returns tens of
-- rows instead of millions.
--
-- WHY A UNION OF THREE PICKS RATHER THAN ONE `ORDER BY ... LIMIT`:
-- The screen asks two different questions and no single ordering answers both.
-- Order by rating_count and a quietly excellent album with four 9.5s never
-- reaches "Top rated". Order by avg_score and this week's hot release never
-- reaches "Trending". So each section gets its own top-N, and the union is what
-- the client slices. The third pick (most-rated overall) exists to give the genre
-- and decade chips enough breadth to be worth showing.
--
-- The client keeps its pure, unit-tested trending()/topRated()/forGenre() —
-- those still take BrowseItem[] and still decide presentation. This function only
-- moves the *tallying*, which is the part that does not fit on a phone.

create or replace function public.browse_items(
  p_window_days int default 7,
  p_per_section int default 200,
  -- When non-null, restrict to items carrying ANY of these genres. The crawlable
  -- /browse/genre/[slug] pages pass their alias list here so a niche genre gets a
  -- correct top-N instead of whatever survived a global cap — those pages are the
  -- SEO surface, and an empty one earns nothing.
  p_genres text[] default null
)
returns table (
  id           text,
  type         text,
  title        text,
  artist       text,
  art_url      text,
  release_year int,
  genres       text[],
  avg_score    numeric,
  rating_count bigint,
  recent_count bigint
)
language sql
stable
-- SECURITY INVOKER (the default) on purpose: ratings and items are public-read,
-- so the caller's own privileges are enough, and running as owner would mean this
-- function has to be trusted rather than merely correct.
set search_path = ''
as $$
  with agg as (
    select
      i.id, i.type, i.title, i.artist, i.art_url, i.release_year, i.genres,
      avg(r.score)::numeric as avg_score,
      count(*) as rating_count,
      count(*) filter (
        where r.created_at > now() - make_interval(days => p_window_days)
      ) as recent_count
    from public.ratings r
    join public.items i on i.id = r.item_id
    where p_genres is null
       or exists (
            select 1
            from unnest(i.genres) as g(v)
            where lower(g.v) = any (select lower(x.v) from unnest(p_genres) as x(v))
          )
    group by i.id, i.type, i.title, i.artist, i.art_url, i.release_year, i.genres
  )
  -- Trending: actually active in the window.
  (select * from agg where recent_count > 0 order by recent_count desc, avg_score desc limit p_per_section)
  union
  -- Top rated: the same floor the client's topRated() applies, so a single 10 by
  -- one person cannot top the chart.
  (select * from agg where rating_count >= 2 order by avg_score desc, rating_count desc limit p_per_section)
  union
  -- Breadth, for the genre/decade chips.
  (select * from agg order by rating_count desc limit p_per_section);
$$;

-- Guests browse — that's the whole point of the tab, and it carries an ad slot.
grant execute on function public.browse_items(int, int, text[]) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- SELF-TEST — see 0021 for why these exist.
-- ---------------------------------------------------------------------------
do $$
declare
  u1 text := '00000000-0000-0000-0000-0000000b0001';
  u2 text := '00000000-0000-0000-0000-0000000b0002';
  rec record;
  n int;
  -- Deliberately unguessable. These assertions count items *by genre*, so the
  -- test is only hermetic if no real row can carry the label — and 'Probe Rock',
  -- the obvious choice, is exactly the sort of thing a seeded catalog turns out
  -- to contain (supabase/test/seed.sql plants one to prove it).
  probe_genres constant text[] := array['Zqx Probe Rock 7f3', 'Zqx Probe Jazz 7f3'];
begin
  perform set_config('request.jwt.claims', '', true);

  insert into public.items (id, type, title, artist, release_year, genres) values
    ('probe-hot',   'album', 'Hot This Week', 'Probe', 2026, array['Zqx Probe Rock 7f3']),
    ('probe-gem',   'album', 'Quiet Gem',     'Probe', 1994, array['Zqx Probe Jazz 7f3']),
    ('probe-stale', 'album', 'Old Favourite', 'Probe', 2001, array['Zqx Probe Rock 7f3']);

  -- Hot: two ratings inside the window, middling scores.
  insert into public.ratings (user_id, item_id, score, created_at) values
    (u1, 'probe-hot', 7.0, now()),
    (u2, 'probe-hot', 7.5, now());
  -- Gem: two ratings, excellent, but long ago — must reach Top rated, not Trending.
  insert into public.ratings (user_id, item_id, score, created_at) values
    (u1, 'probe-gem', 9.5, now() - interval '400 days'),
    (u2, 'probe-gem', 9.6, now() - interval '380 days');
  -- Stale: a single old rating — enough to exist, not enough for Top rated.
  insert into public.ratings (user_id, item_id, score, created_at) values
    (u1, 'probe-stale', 8.0, now() - interval '200 days');

  -- Every assertion below is scoped to `probe_genres`, which nothing real
  -- carries. That is not decoration — it is what makes this test HERMETIC.
  --
  -- The first version of this file queried the whole catalog and passed against
  -- an empty database, then failed the moment it met a real one: with sections
  -- capped to prove a point, a genuine album with a better average correctly beat
  -- the probe out of the "top rated" slot, and the test called that a bug. It
  -- wasn't. The rule this cost us: a self-test runs against production data, so
  -- it must assert only about rows it created itself.

  -- ---- aggregation is arithmetically right ----------------------------
  select * into rec from public.browse_items(7, 200, probe_genres) where id = 'probe-hot';
  if rec.rating_count <> 2 then
    raise exception 'SELF-TEST FAILED: probe-hot rating_count = %, expected 2', rec.rating_count;
  end if;
  if round(rec.avg_score, 2) <> 7.25 then
    raise exception 'SELF-TEST FAILED: probe-hot avg_score = %, expected 7.25', rec.avg_score;
  end if;
  if rec.recent_count <> 2 then
    raise exception 'SELF-TEST FAILED: probe-hot recent_count = %, expected 2', rec.recent_count;
  end if;

  -- ---- the window actually windows -------------------------------------
  select * into rec from public.browse_items(7, 200, probe_genres) where id = 'probe-gem';
  if rec.recent_count <> 0 then
    raise exception 'SELF-TEST FAILED: probe-gem recent_count = %, expected 0 (its ratings are >1yr old)', rec.recent_count;
  end if;

  -- ---- THE UNION'S REASON FOR EXISTING --------------------------------
  -- Within the probe set, one section of size 1 ordered by recency would return
  -- probe-hot alone. The union must still surface the old high-scorer, because
  -- that is exactly the row "Top rated" needs and a single ORDER BY loses it.
  select count(*) into n from public.browse_items(7, 1, probe_genres) where id = 'probe-gem';
  if n <> 1 then
    raise exception 'SELF-TEST FAILED: a high-scoring old item vanished when sections were capped — Top rated would be wrong';
  end if;

  -- ---- genre scoping ---------------------------------------------------
  select count(*) into n from public.browse_items(7, 200, array['zqx probe rock 7f3']);
  if n <> 2 then
    raise exception 'SELF-TEST FAILED: genre filter returned % items, expected the 2 probe-genre ones', n;
  end if;
  -- Case-insensitively, the way the client's hasGenre() compares.
  select count(*) into n from public.browse_items(7, 200, array['ZQX PROBE JAZZ 7F3']);
  if n <> 1 then
    raise exception 'SELF-TEST FAILED: genre filter is case-sensitive; the client compares case-insensitively';
  end if;
  select count(*) into n from public.browse_items(7, 200, array['nonexistent genre']);
  if n <> 0 then
    raise exception 'SELF-TEST FAILED: unknown genre returned % items, expected 0', n;
  end if;

  -- ---- an unrated item never appears ----------------------------------
  -- Given a probe genre deliberately: without one, the genre filter would exclude
  -- it and this assertion would pass for the wrong reason. The ONLY thing keeping
  -- it out of the result must be that nobody rated it.
  insert into public.items (id, type, title, artist, genres)
    values ('probe-unrated', 'album', 'Nobody Rated This', 'Probe', array['Zqx Probe Rock 7f3']);
  select count(*) into n from public.browse_items(7, 200, probe_genres) where id = 'probe-unrated';
  if n <> 0 then
    raise exception 'SELF-TEST FAILED: an unrated item appeared in browse';
  end if;

  delete from public.ratings where item_id like 'probe-%';
  delete from public.items   where id like 'probe-%';

  raise notice 'Browse RPC self-test passed.';
end;
$$;
