-- Avatar uploads (ROADMAP Phase 2 / G4, final slice). The `avatar_url` column
-- already exists (0014); this adds the Storage bucket the client uploads into
-- and the RLS that keeps each user to their own folder.
--
-- Layout: files live at `<uid>/avatar.<ext>` — the first path segment is the
-- owner's auth uid, so the policies below scope writes with
-- storage.foldername(name)[1] = auth.uid(). Reads are public (avatars show on
-- every profile, including to guests). Run AFTER 0014.

-- Public bucket so getPublicUrl() links render without a signed URL.
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

-- Anyone (incl. guests) can read avatars.
drop policy if exists "avatars public read" on storage.objects;
create policy "avatars public read"
  on storage.objects for select
  using (bucket_id = 'avatars');

-- A signed-in user may write/replace/remove only files under their own uid
-- folder. upsert() overwrites the same `<uid>/avatar.<ext>` path each time, so
-- a user keeps a single file (no orphan accumulation).
drop policy if exists "avatars owner insert" on storage.objects;
create policy "avatars owner insert"
  on storage.objects for insert
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "avatars owner update" on storage.objects;
create policy "avatars owner update"
  on storage.objects for update
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "avatars owner delete" on storage.objects;
create policy "avatars owner delete"
  on storage.objects for delete
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
