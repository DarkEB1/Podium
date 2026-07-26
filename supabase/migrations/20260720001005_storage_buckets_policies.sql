-- ============================================================
-- PR-16 — PHOTO UPLOAD FAILS ON ROW-LEVEL SECURITY
--
-- ROOT CAUSE: the four v1 buckets (spec §4A.1, declared in supabase/config.toml
-- and in lib/storage/index.ts STORAGE_BUCKETS) existed only in the local
-- `supabase start` config. Nothing ever created them in a deployed project,
-- and `storage.objects` ships with RLS enabled and no policies — so every
-- upload failed with "new row violates row-level security policy". This is a
-- STORAGE bucket/object policy problem, not a table-RLS problem.
--
-- CONVENTION: object paths are `<auth.uid()>/<uuid>.<ext>` — the first path
-- segment is the owner's user id. `createUploadUrl()` in lib/storage/index.ts
-- mints exactly that shape, and these policies enforce it.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Buckets — idempotent. Limits/MIME lists mirror supabase/config.toml.
-- ------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('avatars', 'avatars', true, 10485760,
   array['image/png', 'image/jpeg', 'image/heic', 'image/webp']),
  ('logos',   'logos',   true, 10485760,
   array['image/png', 'image/jpeg', 'image/heic', 'image/webp']),
  ('covers',  'covers',  true, 10485760,
   array['image/png', 'image/jpeg', 'image/heic', 'image/webp']),
  ('docs',    'docs',    true, 26214400,
   array['image/png', 'image/jpeg', 'image/heic', 'image/webp', 'application/pdf'])
on conflict (id) do nothing;

-- ------------------------------------------------------------
-- 2. storage.objects policies.
--
-- All four v1 buckets are public-read (config.toml `public = true`), so SELECT
-- is open for them. Should a private bucket be added later it must be left out
-- of podium_storage_objects_select_public and given its own owner-only SELECT
-- policy:
--     using (bucket_id = '<private>' and (storage.foldername(name))[1] = auth.uid()::text)
--
-- Writes are always owner-scoped: the first path segment must equal the
-- caller's uid, which is what makes `<uid>/<uuid>.<ext>` mandatory.
-- ------------------------------------------------------------

drop policy if exists "podium_storage_objects_select_public" on storage.objects;
create policy "podium_storage_objects_select_public"
  on storage.objects for select
  using (bucket_id in ('avatars', 'logos', 'covers', 'docs'));

drop policy if exists "podium_storage_objects_insert_own_folder" on storage.objects;
create policy "podium_storage_objects_insert_own_folder"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id in ('avatars', 'logos', 'covers', 'docs')
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "podium_storage_objects_update_own_folder" on storage.objects;
create policy "podium_storage_objects_update_own_folder"
  on storage.objects for update
  to authenticated
  using (
    bucket_id in ('avatars', 'logos', 'covers', 'docs')
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id in ('avatars', 'logos', 'covers', 'docs')
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "podium_storage_objects_delete_own_folder" on storage.objects;
create policy "podium_storage_objects_delete_own_folder"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id in ('avatars', 'logos', 'covers', 'docs')
    and (storage.foldername(name))[1] = auth.uid()::text
  );
