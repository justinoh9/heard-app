-- Hearts on activity-feed cards (PRODUCT_BLUEPRINT §2.C: "Every card has hearts
-- + comments"). Reuses the generic likes table (0002) with a new target_type
-- rather than a new table — a like is the same concept (this user, this thing).

-- The column check and the insert policy both gate target_type; widen both.
alter table public.likes drop constraint if exists likes_target_type_check;
alter table public.likes
  add constraint likes_target_type_check
  check (target_type in ('item', 'comment', 'feed_event'));

drop policy if exists "anyone can insert a like" on public.likes;
create policy "anyone can insert a like"
  on public.likes for insert
  with check (target_type in ('item', 'comment', 'feed_event'));
