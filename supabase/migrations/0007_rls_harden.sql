-- Harden RLS now that Supabase Auth is live (blueprint §3.4). Before this,
-- every table trusted a client-supplied user_id (prototype posture). With real
-- auth, `auth.uid()` identifies the caller, so writes must be by the owner.
--
-- Reads stay PUBLIC — the app shows others' ratings, comments, profiles, and
-- activity, and guests browse them. Only writes tighten.
--
-- Safe because the app sends user_id = the Supabase auth uid (SupabaseAuthBackend
-- sets user.id to auth.uid()), so legitimate writes satisfy auth.uid()::text =
-- user_id. Existing rows (seed / pre-auth) are untouched — RLS governs new
-- writes only. Run AFTER 0001–0006 (or setup.sql) on a project with Supabase
-- Auth enabled.

-- ---- comments: insert only as yourself ----
drop policy if exists "anyone can insert a comment" on public.comments;
create policy "insert own comment" on public.comments for insert
  with check (
    auth.uid()::text = user_id
    and char_length(trim(body)) > 0
    and char_length(body) <= 1000
    and item_type in ('song', 'album')
  );

-- ---- likes: insert/delete only your own ----
drop policy if exists "anyone can insert a like" on public.likes;
create policy "insert own like" on public.likes for insert
  with check (auth.uid()::text = user_id and target_type in ('item', 'comment'));
drop policy if exists "anyone can delete a like" on public.likes;
create policy "delete own like" on public.likes for delete
  using (auth.uid()::text = user_id);

-- ---- items: shared catalog cache — any signed-in user may cache/refresh ----
drop policy if exists "anyone can cache an item" on public.items;
create policy "authed can cache an item" on public.items for insert
  with check (auth.uid() is not null);
drop policy if exists "anyone can refresh a cached item" on public.items;
create policy "authed can refresh an item" on public.items for update
  using (auth.uid() is not null);

-- ---- ratings: insert/update only your own ----
drop policy if exists "anyone can insert a rating" on public.ratings;
create policy "insert own rating" on public.ratings for insert
  with check (auth.uid()::text = user_id);
drop policy if exists "anyone can update a rating" on public.ratings;
create policy "update own rating" on public.ratings for update
  using (auth.uid()::text = user_id);

-- ---- comparisons: append only your own ----
drop policy if exists "anyone can insert a comparison" on public.comparisons;
create policy "insert own comparison" on public.comparisons for insert
  with check (auth.uid()::text = user_id);

-- ---- profiles: create/update only your own ----
drop policy if exists "anyone can create a profile" on public.profiles;
create policy "create own profile" on public.profiles for insert
  with check (auth.uid()::text = user_id);
drop policy if exists "anyone can update a profile" on public.profiles;
create policy "update own profile" on public.profiles for update
  using (auth.uid()::text = user_id);

-- ---- follows: follow/unfollow only as yourself ----
drop policy if exists "anyone can follow" on public.follows;
create policy "follow as self" on public.follows for insert
  with check (auth.uid()::text = follower_id);
drop policy if exists "anyone can unfollow" on public.follows;
create policy "unfollow as self" on public.follows for delete
  using (auth.uid()::text = follower_id);

-- ---- feed_events: publish only your own ----
drop policy if exists "anyone can publish a feed event" on public.feed_events;
create policy "publish own feed event" on public.feed_events for insert
  with check (auth.uid()::text = user_id);

-- ---- concerts: log only your own ----
drop policy if exists "anyone can log a concert" on public.concerts;
create policy "log own concert" on public.concerts for insert
  with check (auth.uid()::text = user_id);

-- ---- concert_tags: only the concert's owner may tag attendees ----
drop policy if exists "anyone can tag attendees" on public.concert_tags;
create policy "owner tags attendees" on public.concert_tags for insert
  with check (auth.uid()::text = (select user_id from public.concerts where id = concert_id));
