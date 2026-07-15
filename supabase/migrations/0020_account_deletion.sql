-- In-app account deletion (ROADMAP Phase 4 / G5).
-- Run AFTER 0001–0019 on a project with Supabase Auth enabled.
--
-- Apple requires any app that offers account *creation* to also offer account
-- *deletion* — in the app, not via an email to support. Our privacy policy also
-- promises it.
--
-- Why a SECURITY DEFINER function rather than an Edge Function: deleting the
-- row in `auth.users` needs privileges the anon/authenticated roles don't have.
-- The usual answer is an Edge Function holding the service-role key, but that
-- means the Supabase CLI, a deploy step, and a second place secrets live. A
-- function owned by `postgres` can do the same job with none of that, and this
-- project already applies migrations by hand in the SQL editor.
--
-- The safety of SECURITY DEFINER rests on two things, both below:
--   1. It derives the target from `auth.uid()` and takes NO arguments, so a
--      caller cannot ask it to delete anyone but themselves.
--   2. `search_path` is empty and every name below is schema-qualified, so a
--      caller can't shadow the tables it touches with their own objects and
--      trick the elevated function into operating on those instead.

create or replace function public.delete_own_account()
returns void
language plpgsql
security definer
-- Empty, not a schema list: every table/function below is fully qualified, so
-- nothing needs resolving, and nothing a caller creates can be resolved *to*.
-- (Built-in types still resolve — pg_catalog is always implicitly searched.)
set search_path = ''
as $$
declare
  uid text := auth.uid()::text;
begin
  if uid is null then
    raise exception 'delete_own_account: no authenticated user';
  end if;

  -- Order matters only where a child would be orphaned; the cascades below do
  -- most of the work (list_items → lists, concert_tags → concerts).

  -- Content
  delete from public.likes           where user_id = uid;
  delete from public.comments        where user_id = uid;
  delete from public.comparisons     where user_id = uid;
  delete from public.ratings         where user_id = uid;
  delete from public.diary_entries   where user_id = uid;
  delete from public.queue_items     where user_id = uid;
  delete from public.drops           where user_id = uid;
  delete from public.feed_events     where user_id = uid;

  -- Lists: list_items cascades off lists.
  delete from public.lists           where user_id = uid;

  -- Concerts: drop your tags on OTHER people's shows first, then your own
  -- shows (whose tags cascade with them).
  delete from public.concert_tags    where user_id = uid;
  delete from public.concerts        where user_id = uid;

  -- Social graph: both directions.
  delete from public.follows         where follower_id = uid or followee_id = uid;

  -- Safety data. Reports you filed AND reports about you: once the account is
  -- gone the target no longer exists, and keeping them would retain an
  -- identifier for a user who asked to be erased. This does not let an abuser
  -- launder their history — a new signup gets a new uid regardless, so the
  -- record was never going to follow them.
  delete from public.blocks          where blocker_id = uid or blocked_id = uid;
  delete from public.reports         where reporter_id = uid or target_user_id = uid;

  -- Directory row.
  delete from public.profiles        where user_id = uid;

  -- Avatar: files live at `<uid>/avatar.<ext>` (0015), so the first path
  -- segment identifies the owner.
  -- The avatar is NOT deleted here. Supabase guards its storage tables with a
  -- `storage.protect_delete()` trigger that rejects direct DML ("Direct deletion
  -- from storage tables is not allowed. Use the Storage API instead."), so the
  -- line that used to live here didn't merely fail to remove the file — it threw,
  -- and took the whole account deletion down with it. It was there from 0020 and
  -- never once worked.
  --
  -- The client removes the avatar through the Storage API *before* calling this
  -- function, while the account still exists to authorize it (the bucket's RLS is
  -- owner-scoped). See SupabaseAuthBackend.removeAvatar.

  -- Deliberately NOT touched: public.items. It's the shared, insert-only
  -- catalog cache (title/artist/art for songs everyone rates) — it holds no
  -- personal data and other users' ratings point at it.

  -- Finally the account itself. Cascades through auth.identities / sessions /
  -- refresh_tokens, which is what invalidates any live session elsewhere.
  delete from auth.users where id = auth.uid();
end;
$$;

-- Callable only by a signed-in user. (The auth.uid() guard above already stops
-- anon, but revoking is the belt to that braces — a SECURITY DEFINER function
-- should never be executable by more roles than strictly need it.)
revoke all on function public.delete_own_account() from public, anon;
grant execute on function public.delete_own_account() to authenticated;
