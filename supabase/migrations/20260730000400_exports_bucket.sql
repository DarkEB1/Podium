-- ============================================================
-- QA-1.7 — GDPR DATA EXPORT HAD NOWHERE TO WRITE
--
-- processExportRequest() (lib/supabase/data-export.ts) assembled the export and
-- uploaded it as contentType 'application/json' into the `docs` bucket, whose
-- allowed_mime_types is images plus application/pdf (it exists for media packs
-- and sponsorship briefs). Storage rejected every upload with
--
--   {"statusCode":"415","error":"invalid_mime_type",
--    "message":"mime type application/json is not supported"}
--
-- so every "download my data" request failed, permanently, for every user. The
-- cron's catch discarded the error, so the only visible trace was a request row
-- flipping to 'failed' with no reason.
--
-- Fixed with a dedicated private bucket rather than by adding JSON to `docs`:
--
--   * `docs` is readable by an active-match counterparty (SEC-3 /
--     can_read_user_folder, 20260720005002). That is right for a media pack and
--     very wrong for a complete personal-data dump. Exports are owner-only.
--   * an export path can then be `<uid>/<request>.json`, so the owner-scoped
--     policy convention actually applies to it. The previous code wrote
--     `exports/<uid>/<request>.json`, where the first path segment was the
--     literal 'exports' and no owner policy could ever match.
--
-- Writes are service-role only: the file is produced by the data-export cron,
-- never uploaded by a browser, so there is no INSERT policy for `authenticated`
-- at all. lib/storage/index.ts refuses to presign uploads for this bucket.
--
-- DDL on storage.* needs supabase_storage_admin, so every statement is guarded
-- the way 20260720005002 established: probe the table, downgrade a permission
-- failure to a warning rather than taking the transaction down with it.
-- ============================================================

do $$
begin
  if to_regclass('storage.buckets') is null then
    raise notice 'QA-1.7: storage.buckets not present; skipping exports bucket.';
    return;
  end if;

  -- do update, not do nothing: a project where this bucket was created by hand
  -- with the wrong flags gets corrected.
  insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  values ('exports', 'exports', false, 52428800, array['application/json'])
  on conflict (id) do update
    set public             = excluded.public,
        file_size_limit    = excluded.file_size_limit,
        allowed_mime_types = excluded.allowed_mime_types;
exception
  when insufficient_privilege then
    raise warning 'QA-1.7: no privilege to write storage.buckets; create the private exports bucket (application/json) manually.';
end;
$$;

do $$
begin
  if to_regclass('storage.objects') is null then
    raise notice 'QA-1.7: storage.objects not present; skipping exports policies.';
    return;
  end if;

  -- Owner only, plus admins for support. Deliberately narrower than the `docs`
  -- policy: no match counterparty may read another user's data export.
  execute 'drop policy if exists "podium_storage_objects_select_exports" on storage.objects';
  execute
    'create policy "podium_storage_objects_select_exports"
       on storage.objects for select
       to authenticated
       using (
         bucket_id = ''exports''
         and (
           (storage.foldername(name))[1] = auth.uid()::text
           or public.is_admin()
         )
       )';
exception
  when insufficient_privilege then
    raise warning 'QA-1.7: no privilege to write storage.objects policies; add the owner-only exports SELECT policy manually.';
end;
$$;
