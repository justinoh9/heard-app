-- Reposts (ROADMAP Phase 2 / F4; PRODUCT_BLUEPRINT §1.3). Let a user reshare
-- someone else's rating/review/drop/concert into their own feed with an
-- optional note — the cheapest way to give quiet users something to contribute
-- and to spread good reviews.
--
-- A repost is just another feed_events row (type 'repost'); its payload
-- denormalizes the original content (title/artist/art/score/review/item link)
-- plus the reposter's `note` and attribution to the original author. So the
-- only schema change is widening the type check — same pattern as 0006
-- (concert) and 0010 (made_list). Run AFTER 0012.

alter table public.feed_events drop constraint feed_events_type_check;
alter table public.feed_events
  add constraint feed_events_type_check
  check (type in ('rated', 'drop', 'streak', 'concert', 'made_list', 'repost'));
