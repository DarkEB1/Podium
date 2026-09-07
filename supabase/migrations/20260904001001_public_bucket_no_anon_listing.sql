-- ============================================================
-- PM-34 / WS-PROFILE — PUBLIC BUCKETS: NO ANONYMOUS FOLDER LISTING
--
-- 20260720005002_storage_bucket_visibility.sql:149-153 left the SELECT policy
-- for the public image buckets open to `anon`:
--
--     create policy "podium_storage_objects_select_public_buckets"
--       on storage.objects for select
--       to anon, authenticated
--       using (bucket_id in ('avatars', 'logos', 'covers'));
--
-- A row-visible SELECT policy on storage.objects also authorises the LIST
-- operation (storage.from('avatars').list('')). Granting it to `anon` let any
-- unauthenticated caller with the public anon key ENUMERATE every user's
-- `<uid>/` folder across all three public buckets: user-id enumeration, and —
-- together with PM-10, where replaced photos were never deleted — discovery of
-- every superseded (possibly minor's) photo still sitting in storage.
--
-- FIX: restrict this SELECT policy to `authenticated`. This does NOT affect
-- image rendering: public buckets are served through the unauthenticated
-- `/object/public/<bucket>/<path>` endpoint (getPublicUrl, lib/storage), which
-- bypasses RLS entirely — the SELECT policy governs the storage.objects TABLE
-- (list + the authenticated object endpoint), not public object serving. And
-- there are no logged-out profile pages that would need anon reads. Anonymous
-- enumeration is closed; nothing a signed-in user sees changes.
--
-- (Authenticated cross-folder listing is a lesser, separate concern and is left
-- as noted follow-up: tightening it to own-folder-or-active-match would mirror
-- the `docs` policy, but is not required to close the anonymous leak.)
--
-- Same defensive wrapper as 20260720005002: storage.objects DDL needs ownership
-- of that table (supabase_storage_admin); a permission failure downgrades to a
-- warning instead of taking the whole migration transaction down with it. The
-- block is fully re-runnable.
-- ============================================================

do $$
declare
  v_public_buckets constant text := $q$('avatars', 'logos', 'covers')$q$;
begin
  if to_regclass('storage.objects') is null then
    raise notice 'PM-34: storage.objects not present; skipping.';
    return;
  end if;

  -- Replace the anon-readable policy with an authenticated-only one.
  execute 'drop policy if exists "podium_storage_objects_select_public_buckets" on storage.objects';
  execute format(
    'create policy "podium_storage_objects_select_public_buckets"
       on storage.objects for select
       to authenticated
       using (bucket_id in %s)', v_public_buckets);
exception
  when insufficient_privilege then
    raise warning 'PM-34: no ownership of storage.objects (needs supabase_storage_admin); the public-bucket SELECT policy was NOT tightened. Apply from the Supabase dashboard or with `set local role supabase_storage_admin`.';
end;
$$;
