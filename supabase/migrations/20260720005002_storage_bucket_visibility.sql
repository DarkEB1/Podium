-- ============================================================
-- SEC-3 / SEC-4 — STORAGE: PRIVATE DOCS BUCKET + DEFENSIVE POLICY DDL
--
-- Supersedes 20260720001005_storage_buckets_policies.sql (left untouched).
--
-- SEC-3 (data exposure): 20260720001005:19-29 created ALL FOUR buckets with
--   public = true, and :44-47 created
--       create policy "podium_storage_objects_select_public"
--         on storage.objects for select
--         using (bucket_id in ('avatars','logos','covers','docs'));
--   with no `to authenticated`. A policy with no role list applies to PUBLIC,
--   i.e. `anon` as well — so any unauthenticated caller could not only fetch
--   but ENUMERATE storage.objects across every user's folder. The `docs`
--   bucket holds team media packs and sponsorship-brief PDFs (uploaded by
--   components/team/team-profile-form.tsx). The uuid filename was the only
--   thing standing between those documents and the internet, and listing
--   storage.objects removed even that.
--
--   DECISION, per bucket:
--     avatars / logos / covers  -> genuinely public. They are rendered on
--       public profile pages through getPublicUrl() (lib/storage/index.ts),
--       which produces an unsigned /object/public/ URL that only resolves when
--       the bucket is public. These stay public = true and keep an anon-
--       readable SELECT policy.
--     docs                      -> private. Business documents, never rendered
--       on a public page. Flipped to public = false, SELECT restricted to the
--       owning user, to a counterparty the owner shares an ACTIVE match with
--       (the schema does express this: public.matches is the only relationship
--       table linking two user ids, and object paths are `<owner uid>/<uuid>`),
--       and to admins.
--
--   NOTE the original used `on conflict (id) do nothing`, so on any project
--   where the buckets already existed the flags were never corrected. This
--   migration uses `do update`, so it fixes pre-existing rows.
--
--   KNOWN FOLLOW-UP (outside this migration's ownership): making `docs`
--   private means getPublicUrl() links for team_profiles.media_pack_url and
--   team_profiles.sponsorship_brief_url stop resolving. Those call sites
--   (lib/storage/index.ts createUploadUrl -> publicUrl, and
--   components/team/team-profile-form.tsx) must switch to
--   createSignedUrl()/download at render time. Until they do, doc downloads
--   will 400 — which is the correct failure mode for a private document, but
--   it is a behaviour change, not a silent one.
--
-- SEC-4 (would-fail migration): `create policy` / `drop policy` on
--   storage.objects requires ownership of that table (supabase_storage_admin).
--   20260720001005 issued that DDL bare — no to_regclass guard, no exception
--   handler (unlike 20260720003000_gdpr_erasure.sql:120, which does guard).
--   On a database where the migration role lacks the privilege the statement
--   aborts, the whole transaction rolls back, and PR-16 silently reverts.
--   Everything below is therefore wrapped: the storage schema is probed first,
--   and a permission failure downgrades to `raise warning` instead of taking
--   the transaction with it. The block is fully re-runnable.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Helper: may the caller read another user's private object folder?
--
-- SECURITY DEFINER so the storage policy does not have to re-enter RLS on
-- public.matches. Takes TEXT, not UUID: the value comes from
-- storage.foldername(name)[1] and a malformed path must return false, not
-- raise 22P02 (invalid_text_representation) inside a policy.
-- ------------------------------------------------------------
create or replace function public.can_read_user_folder(p_folder text)
returns boolean
language sql
security definer set search_path = public
stable
as $$
  select p_folder is not null
     and auth.uid() is not null
     and (
       p_folder = auth.uid()::text
       or exists (
         select 1
           from public.matches m
          where m.status = 'active'
            and (
              (m.user_a_id = auth.uid() and m.user_b_id::text = p_folder)
              or (m.user_b_id = auth.uid() and m.user_a_id::text = p_folder)
            )
       )
     );
$$;

comment on function public.can_read_user_folder(text) is
  'SEC-3: true when the caller owns the `<uid>/` storage folder, or shares an ACTIVE match with its owner. Used by the private `docs` bucket SELECT policy. Text argument so a malformed object path returns false instead of raising.';

revoke all on function public.can_read_user_folder(text) from public;
grant execute on function public.can_read_user_folder(text) to authenticated, service_role;

-- ------------------------------------------------------------
-- 2. Bucket visibility — corrects existing rows, not just missing ones.
-- ------------------------------------------------------------
do $$
begin
  if to_regclass('storage.buckets') is null then
    raise notice 'SEC-3: storage.buckets not present; skipping bucket visibility.';
    return;
  end if;

  insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  values
    ('avatars', 'avatars', true,  10485760,
     array['image/png', 'image/jpeg', 'image/heic', 'image/webp']),
    ('logos',   'logos',   true,  10485760,
     array['image/png', 'image/jpeg', 'image/heic', 'image/webp']),
    ('covers',  'covers',  true,  10485760,
     array['image/png', 'image/jpeg', 'image/heic', 'image/webp']),
    -- private: media packs and sponsorship briefs
    ('docs',    'docs',    false, 26214400,
     array['image/png', 'image/jpeg', 'image/heic', 'image/webp', 'application/pdf'])
  on conflict (id) do update
    set public             = excluded.public,
        file_size_limit    = excluded.file_size_limit,
        allowed_mime_types = excluded.allowed_mime_types;
exception
  when insufficient_privilege then
    raise warning 'SEC-3: no privilege to write storage.buckets; set docs.public = false manually.';
end;
$$;

-- ------------------------------------------------------------
-- 3. storage.objects policies.
--
-- Re-declares ALL of them (not just SELECT) so this migration still leaves a
-- correct state on a database where 20260720001005 aborted at its first
-- `create policy` and therefore installed nothing.
--
-- Path convention is unchanged: `<auth.uid()>/<uuid>.<ext>`, minted by
-- createUploadUrl() in lib/storage/index.ts. Writes stay owner-scoped.
-- ------------------------------------------------------------
do $$
declare
  v_public_buckets constant text := $q$('avatars', 'logos', 'covers')$q$;
  v_all_buckets    constant text := $q$('avatars', 'logos', 'covers', 'docs')$q$;
begin
  if to_regclass('storage.objects') is null then
    raise notice 'SEC-4: storage.objects not present; skipping object policies.';
    return;
  end if;

  -- The superseded blanket policy: every bucket, every role including anon.
  execute 'drop policy if exists "podium_storage_objects_select_public" on storage.objects';

  -- Public profile imagery — deliberately readable by anon so unsigned
  -- getPublicUrl() links on public profile pages keep working.
  execute 'drop policy if exists "podium_storage_objects_select_public_buckets" on storage.objects';
  execute format(
    'create policy "podium_storage_objects_select_public_buckets"
       on storage.objects for select
       to anon, authenticated
       using (bucket_id in %s)', v_public_buckets);

  -- Private documents — owner, active-match counterparty, or admin.
  execute 'drop policy if exists "podium_storage_objects_select_docs" on storage.objects';
  execute
    'create policy "podium_storage_objects_select_docs"
       on storage.objects for select
       to authenticated
       using (
         bucket_id = ''docs''
         and (
           public.can_read_user_folder((storage.foldername(name))[1])
           or public.is_admin()
         )
       )';

  execute 'drop policy if exists "podium_storage_objects_insert_own_folder" on storage.objects';
  execute format(
    'create policy "podium_storage_objects_insert_own_folder"
       on storage.objects for insert
       to authenticated
       with check (
         bucket_id in %s
         and (storage.foldername(name))[1] = auth.uid()::text
       )', v_all_buckets);

  execute 'drop policy if exists "podium_storage_objects_update_own_folder" on storage.objects';
  execute format(
    'create policy "podium_storage_objects_update_own_folder"
       on storage.objects for update
       to authenticated
       using (
         bucket_id in %s
         and (storage.foldername(name))[1] = auth.uid()::text
       )
       with check (
         bucket_id in %s
         and (storage.foldername(name))[1] = auth.uid()::text
       )', v_all_buckets, v_all_buckets);

  execute 'drop policy if exists "podium_storage_objects_delete_own_folder" on storage.objects';
  execute format(
    'create policy "podium_storage_objects_delete_own_folder"
       on storage.objects for delete
       to authenticated
       using (
         bucket_id in %s
         and (storage.foldername(name))[1] = auth.uid()::text
       )', v_all_buckets);
exception
  when insufficient_privilege then
    raise warning 'SEC-4: no ownership of storage.objects (needs supabase_storage_admin); storage policies were NOT applied. Apply them from the Supabase dashboard or with `set local role supabase_storage_admin`.';
  when undefined_function then
    raise warning 'SEC-4: storage.foldername() unavailable; storage policies were NOT applied.';
end;
$$;
