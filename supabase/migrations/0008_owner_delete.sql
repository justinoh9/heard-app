-- Owner deletes + items cache lockdown (Phase 0, ROADMAP R4 + R7).
--
-- R4: 0007 hardened writes to the owner but left no DELETE policies at all, so
-- users could never remove their own content. Every delete below is scoped to
-- auth.uid(), matching 0007's write posture. Reads stay public.
--
-- R7: 0007's items UPDATE policy let ANY signed-in user rewrite any cached
-- item's title/art for everyone (shared-cache vandalism). The cache is now
-- insert-only — the client upserts with ignoreDuplicates (ON CONFLICT DO
-- NOTHING), so no update path is needed. Metadata refresh becomes a future
-- server-side enrichment job (blueprint §2.A).
--
-- Run AFTER 0007.

-- ---- comments: delete your own ----
create policy "delete own comment" on public.comments for delete
  using (auth.uid()::text = user_id);

-- ---- ratings: delete your own ----
create policy "delete own rating" on public.ratings for delete
  using (auth.uid()::text = user_id);

-- ---- comparisons: delete your own (the app keeps the bank; this is for
-- user-initiated data removal) ----
create policy "delete own comparison" on public.comparisons for delete
  using (auth.uid()::text = user_id);

-- ---- concerts: delete your own (tags cascade via FK) ----
create policy "delete own concert" on public.concerts for delete
  using (auth.uid()::text = user_id);

-- ---- concert_tags: untag yourself, or the concert's owner removes any tag ----
create policy "untag self or own concert" on public.concert_tags for delete
  using (
    auth.uid()::text = user_id
    or auth.uid()::text = (select user_id from public.concerts where id = concert_id)
  );

-- ---- feed_events: delete your own ----
create policy "delete own feed event" on public.feed_events for delete
  using (auth.uid()::text = user_id);

-- ---- items: drop the update path entirely (insert-only shared cache) ----
drop policy if exists "authed can refresh an item" on public.items;
drop policy if exists "anyone can refresh a cached item" on public.items;
