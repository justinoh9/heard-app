-- Comment threads: one level of replies. A reply is a comment with a
-- parent_id pointing at the top-level comment it answers; top-level comments
-- have parent_id null. Deleting a parent cascades to its replies (so the
-- existing owner-delete policy on the parent cleans up the thread), while a
-- reply can still be deleted on its own.
--
-- Run AFTER 0001–0015 on a project with Supabase Auth enabled. No backfill
-- needed: every existing comment is already a (null-parent) top-level comment.

alter table public.comments
  add column if not exists parent_id uuid references public.comments (id) on delete cascade;

-- Fast lookup of a comment's replies, newest-tracking not needed (threads read
-- oldest-first), so index by parent alone.
create index if not exists comments_parent_idx on public.comments (parent_id);

-- The insert policy from 0007 ("insert own comment") still governs writes; it
-- checks auth.uid()::text = user_id and body length, and does not constrain
-- parent_id, so replies insert under the same ownership rule. A reply's
-- parent_id can only reference an existing comment (FK), and public read
-- already exposes the whole thread — no policy change required.
