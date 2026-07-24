-- ============================================================
-- DI-4 / CL-3 — GDPR ERASURE EXECUTION
--
-- `users.deletion_requested_at` / `deletion_scheduled_at` were being set by
-- lib/supabase/auth.ts `requestDeletion()` but nothing ever executed the
-- erasure. This migration adds the job that fulfils the promise.
--
-- Entry point:  public.process_scheduled_deletions(p_limit int default 100)
-- Per user:     public.erase_user_data(p_user_id uuid)
-- Driven by:    app/api/cron/gdpr-deletion  (Vercel Cron, CRON_SECRET bearer)
--
-- ------------------------------------------------------------
-- PRODUCT DECISION
-- ------------------------------------------------------------
-- Financial records and concluded contracts are ANONYMISED, never deleted:
-- `contracts.retain_until` is locked_at + 7 years and UK accounting/limitation
-- rules require the underlying payment record. Everything else that is
-- personal data is HARD-DELETED.
--
-- The `public.users` row itself is NOT deleted. It is turned into a tombstone
-- (`deleted-<uuid>@deleted.podium.invalid`, every personal column cleared) so
-- that the NOT NULL foreign keys on contracts, payments, proposals, reports and
-- audit_logs remain valid. A tombstone identifies nobody.
--
-- The matching `auth.users` row is scrubbed and permanently banned rather than
-- deleted, because `public.users.id references auth.users(id) on delete cascade`
-- — deleting it would cascade the tombstone away and take the retained
-- financial records with it.
--
-- ------------------------------------------------------------
-- PER-TABLE ERASURE POLICY (every table in the schema, deliberately decided)
-- ------------------------------------------------------------
--  TABLE                    POLICY      RATIONALE
--  auth.users               ANONYMISE   scrub email/password/metadata + ban;
--                                       cannot delete (cascades the tombstone)
--  users                    ANONYMISE   tombstone; FK anchor for retained rows
--  athlete_profiles         DELETE      DOB, under-18 flag, guardian details,
--                                       photos, socials, payout details
--  team_profiles            DELETE      named contacts, phones, emails
--  agent_profiles           DELETE      personal/agency identity
--  brand_profiles           CONDITIONAL DELETE when the brand has no retained
--                                       subscription; otherwise ANONYMISE,
--                                       because subscriptions.brand_id cascades
--                                       from this row and must survive
--  profile_settings         DELETE      preferences, no retention basis
--  representation_links     DELETE      relationship metadata, both sides
--  team_admins              DELETE      invited_email/full_name are personal
--  auth_2fa                 DELETE      credential material
--  active_sessions          DELETE      IP, user agent, device label
--  login_history            DELETE      IP, user agent, coarse location
--  data_export_requests     DELETE      presigned URLs to a full data dump
--  payment_methods          DELETE      card metadata; Stripe holds the record
--  job_listings             DELETE      brand marketing copy, no retention basis
--  connection_requests      DELETE      free-text intro message, both directions
--  matches                  CONDITIONAL DELETE when no contract references the
--                                       match; retained (participants are
--                                       tombstones) where one does, because
--                                       contracts.match_id has no ON DELETE
--  messages                 DELETE      all messages in the user's matches,
--                                       including attachments metadata
--  shortlists               DELETE      both as owner and as target
--  blocks                   DELETE      both directions; moot once erased
--  notification_logs        DELETE      title/body may quote personal content
--  proposals                ANONYMISE   free-text `additional_terms` cleared;
--                                       commercial terms kept (contract record)
--  contracts                ANONYMISE   signer IP + device strings cleared;
--                                       amounts, dates, ids, signature
--                                       timestamps kept until retain_until
--  payments                 ANONYMISE   receipt_url (renders name/address)
--                                       cleared; amounts/fees/dates/ids kept
--  subscriptions            ANONYMISE   billing record kept; no personal
--                                       columns beyond the Stripe ids
--  reports                  RETAIN      safety record; free-text `detail` and
--                                       `admin_notes` cleared once the report
--                                       is closed (resolved/dismissed)
--  audit_logs               RETAIN      immutable; `ip_address` on the user's
--                                       own entries cleared. One new entry is
--                                       written recording the erasure.
--  storage.objects          DELETE      profile photos, action shots,
--                                       highlight videos, media packs
--
-- Every erasure writes an `audit_logs` row: action 'gdpr_erasure_executed',
-- target_type 'user', target_id = the erased user id, actor_id NULL (system).
-- ============================================================

-- ------------------------------------------------------------
-- erase_user_data — erases ONE user. Idempotent: re-running against an
-- already-tombstoned user is a no-op returning 'already_erased'.
-- ------------------------------------------------------------
create or replace function public.erase_user_data(p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email             text;
  v_tombstone_email   text;
  v_has_subscription  boolean;
  v_deleted           jsonb := '{}'::jsonb;
  v_count             bigint;
begin
  select email into v_email from public.users where id = p_user_id;

  if v_email is null then
    return jsonb_build_object('user_id', p_user_id, 'status', 'not_found');
  end if;

  if v_email like 'deleted-%@deleted.podium.invalid' then
    return jsonb_build_object('user_id', p_user_id, 'status', 'already_erased');
  end if;

  v_tombstone_email := 'deleted-' || p_user_id::text || '@deleted.podium.invalid';

  -- ==========================================================
  -- 1. STORAGE OBJECTS — profile photos, action shots, videos, media packs.
  --    Guarded so the function still installs on a database without the
  --    Supabase storage schema (local test harness).
  -- ==========================================================
  if to_regclass('storage.objects') is not null then
    execute 'delete from storage.objects where owner = $1' using p_user_id;
  end if;

  -- ==========================================================
  -- 2. SECURITY, SESSION AND PREFERENCE DATA — hard delete, no retention basis
  -- ==========================================================
  delete from public.active_sessions      where user_id = p_user_id;
  delete from public.login_history        where user_id = p_user_id;
  delete from public.auth_2fa             where user_id = p_user_id;
  delete from public.data_export_requests where user_id = p_user_id;
  delete from public.payment_methods      where user_id = p_user_id;
  delete from public.notification_logs    where user_id = p_user_id;
  delete from public.profile_settings     where user_id = p_user_id;

  -- Discovery relationships, both directions.
  delete from public.shortlists
    where user_id = p_user_id or target_user_id = p_user_id;
  delete from public.blocks
    where blocker_id = p_user_id or blocked_id = p_user_id;

  -- ==========================================================
  -- 3. MESSAGES — every message in every match the user took part in.
  --    A 1:1 conversation is jointly personal data; the counterparty's
  --    retained record of the deal is the contract, not the chat.
  -- ==========================================================
  delete from public.messages
   where match_id in (
     select id from public.matches
      where user_a_id = p_user_id or user_b_id = p_user_id
   );
  get diagnostics v_count = row_count;
  v_deleted := v_deleted || jsonb_build_object('messages', v_count);

  -- ==========================================================
  -- 4. MATCHES + CONNECTION REQUESTS
  --    contracts.match_id has no ON DELETE clause, so a match backing a
  --    contract must survive. Detach connection_request_id first so the
  --    connection request (free-text intro message) can be deleted.
  -- ==========================================================
  update public.matches
     set connection_request_id = null
   where user_a_id = p_user_id or user_b_id = p_user_id;

  -- Deleting a match cascades its proposals; only safe where no contract
  -- references the match.
  delete from public.matches m
   where (m.user_a_id = p_user_id or m.user_b_id = p_user_id)
     and not exists (select 1 from public.contracts c where c.match_id = m.id);
  get diagnostics v_count = row_count;
  v_deleted := v_deleted || jsonb_build_object('matches', v_count);

  delete from public.connection_requests
   where sender_id = p_user_id or recipient_id = p_user_id;
  get diagnostics v_count = row_count;
  v_deleted := v_deleted || jsonb_build_object('connection_requests', v_count);

  -- ==========================================================
  -- 5. PROPOSALS — surviving rows belong to a contracted match. Strip the
  --    free-text field (may contain names, addresses, contact details);
  --    keep amount, currency, type, dates and ids for the contract record.
  -- ==========================================================
  update public.proposals
     set additional_terms = null
   where sender_id = p_user_id
     and additional_terms is not null;
  get diagnostics v_count = row_count;
  v_deleted := v_deleted || jsonb_build_object('proposals_anonymised', v_count);

  -- ==========================================================
  -- 6. CONTRACTS — retained until retain_until (locked_at + 7 years).
  --    Signature IP addresses and device strings are personal data that the
  --    retention obligation does not require, so they go; the signature
  --    TIMESTAMPS and the e-signature envelope reference stay, because they
  --    are what makes the retained contract evidentially useful.
  -- ==========================================================
  update public.contracts
     set brand_signer_ip       = case when brand_id = p_user_id then null else brand_signer_ip end,
         brand_signer_device   = case when brand_id = p_user_id then null else brand_signer_device end,
         athlete_signer_ip     = case when athlete_or_team_id = p_user_id then null else athlete_signer_ip end,
         athlete_signer_device = case when athlete_or_team_id = p_user_id then null else athlete_signer_device end,
         agent_signer_ip       = case when agent_id = p_user_id then null else agent_signer_ip end,
         -- The signed PDF is the contract itself and is retained under the
         -- legal-obligation basis, but only until its retention date.
         document_url          = case
                                   when retain_until is not null and retain_until <= now() then null
                                   else document_url
                                 end
   where brand_id = p_user_id
      or athlete_or_team_id = p_user_id
      or agent_id = p_user_id;
  get diagnostics v_count = row_count;
  v_deleted := v_deleted || jsonb_build_object('contracts_anonymised', v_count);

  -- ==========================================================
  -- 7. PAYMENTS — financial record, retained. The receipt renders the payer's
  --    name and address, so the link is dropped; amounts, fees, currency,
  --    status, timestamps and Stripe ids are kept for reconciliation.
  -- ==========================================================
  update public.payments
     set receipt_url = null
   where payer_id = p_user_id
      or payee_id = p_user_id;
  get diagnostics v_count = row_count;
  v_deleted := v_deleted || jsonb_build_object('payments_anonymised', v_count);

  -- ==========================================================
  -- 8. REPRESENTATION LINKS / TEAM ADMINS — relationship metadata, deleted
  --    from both sides. Rows attached to the user's own agent/team profile
  --    cascade when that profile is deleted below.
  -- ==========================================================
  delete from public.representation_links where client_user_id = p_user_id;
  delete from public.team_admins          where user_id = p_user_id;

  -- ==========================================================
  -- 9. ROLE PROFILES
  -- ==========================================================
  delete from public.athlete_profiles where user_id = p_user_id;
  delete from public.team_profiles    where user_id = p_user_id;
  delete from public.agent_profiles   where user_id = p_user_id;

  -- Brand: listings are marketing copy and go. subscriptions.brand_id
  -- CASCADES from brand_profiles, and the subscription is a retained billing
  -- record — so the brand profile is anonymised in place whenever one exists,
  -- and deleted outright when it does not.
  delete from public.job_listings
   where brand_id in (select id from public.brand_profiles where user_id = p_user_id);

  select exists (
    select 1
      from public.subscriptions s
      join public.brand_profiles bp on bp.id = s.brand_id
     where bp.user_id = p_user_id
  ) into v_has_subscription;

  if v_has_subscription then
    update public.brand_profiles
       set company_name                = 'Deleted brand',
           trading_name                = null,
           description                 = null,
           headquarters_city           = null,
           headquarters_country        = null,
           website_url                 = null,
           linkedin_url                = '',
           social_accounts             = '{}'::jsonb,
           logo_url                    = null,
           cover_image_url             = null,
           company_registration_number = null,
           vat_number                  = null,
           rejection_reason            = null,
           status                      = 'suspended'
     where user_id = p_user_id;
  else
    delete from public.brand_profiles where user_id = p_user_id;
  end if;

  -- ==========================================================
  -- 10. REPORTS — safety records are retained (they document decisions we may
  --     have to justify), but the free text is cleared once the report is
  --     closed, at which point it no longer serves that purpose.
  -- ==========================================================
  update public.reports
     set detail = null,
         admin_notes = null
   where (reporter_id = p_user_id or reported_user_id = p_user_id)
     and status in ('resolved', 'dismissed');

  -- ==========================================================
  -- 11. AUDIT LOGS — append-only and retained, but the IP address recorded
  --     against the user's own actions is personal data we no longer need.
  -- ==========================================================
  update public.audit_logs
     set ip_address = null
   where actor_id = p_user_id
     and ip_address is not null;

  -- ==========================================================
  -- 12. USERS — tombstone. Not deleted: the FK anchor for everything above.
  -- ==========================================================
  update public.users
     set email                    = v_tombstone_email,
         email_verified           = false,
         cookie_prefs             = null,
         terms_version            = null,
         privacy_version          = null,
         terms_accepted_at        = null,
         privacy_accepted_at      = null,
         data_export_requested_at = null,
         deactivated_at           = now(),
         deletion_scheduled_at    = null
   where id = p_user_id;

  -- ==========================================================
  -- 13. AUTH — scrub the credential record and ban it permanently. Deleting it
  --     would cascade the tombstone (and the retained financial records) away.
  -- ==========================================================
  if to_regclass('auth.users') is not null then
    execute $auth$
      update auth.users
         set email               = $2,
             encrypted_password  = null,
             phone               = null,
             raw_user_meta_data  = '{}'::jsonb,
             raw_app_meta_data   = '{}'::jsonb,
             banned_until        = 'infinity'::timestamptz,
             email_confirmed_at  = null
       where id = $1
    $auth$ using p_user_id, v_tombstone_email;
  end if;

  -- ==========================================================
  -- 14. AUDIT ENTRY — the record that the erasure happened. actor_id is NULL
  --     because the actor is the system (cron), per the audit_logs comment.
  -- ==========================================================
  insert into public.audit_logs (actor_id, action, target_type, target_id, metadata)
  values (
    null,
    'gdpr_erasure_executed',
    'user',
    p_user_id,
    jsonb_build_object(
      'executed_at', now(),
      'policy', 'hard-delete personal data; anonymise contracts, proposals, payments, subscriptions',
      'counts', v_deleted
    )
  );

  return jsonb_build_object(
    'user_id', p_user_id,
    'status', 'erased',
    'counts', v_deleted
  );
end;
$$;

comment on function public.erase_user_data(uuid) is
  'GDPR Art. 17 erasure for a single user. Hard-deletes personal data; anonymises contracts, proposals, payments and subscriptions (7-year retention); tombstones the users and auth.users rows. Service role only.';

-- ------------------------------------------------------------
-- process_scheduled_deletions — the cron entry point. Erases every user whose
-- grace period has expired. Each user is erased in its own transaction-safe
-- block: one failure is reported and skipped rather than aborting the batch.
-- ------------------------------------------------------------
create or replace function public.process_scheduled_deletions(p_limit integer default 100)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user       record;
  v_results    jsonb := '[]'::jsonb;
  v_erased     integer := 0;
  v_failed     integer := 0;
begin
  for v_user in
    select id
      from public.users
     where deletion_scheduled_at is not null
       and deletion_scheduled_at <= now()
       and email not like 'deleted-%@deleted.podium.invalid'
     order by deletion_scheduled_at asc
     limit greatest(p_limit, 0)
  loop
    begin
      v_results := v_results || jsonb_build_array(public.erase_user_data(v_user.id));
      v_erased := v_erased + 1;
    exception when others then
      v_failed := v_failed + 1;
      v_results := v_results || jsonb_build_array(
        jsonb_build_object('user_id', v_user.id, 'status', 'failed', 'error', sqlerrm)
      );
    end;
  end loop;

  return jsonb_build_object(
    'processed_at', now(),
    'erased', v_erased,
    'failed', v_failed,
    'results', v_results
  );
end;
$$;

comment on function public.process_scheduled_deletions(integer) is
  'Erases every user whose deletion_scheduled_at has passed. Called by app/api/cron/gdpr-deletion with the service-role client. Service role only.';

-- ------------------------------------------------------------
-- Privileges — service role only. These functions bypass RLS by design and
-- must never be callable from an anon or authenticated session.
-- ------------------------------------------------------------
revoke all on function public.erase_user_data(uuid) from public;
revoke all on function public.process_scheduled_deletions(integer) from public;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    execute 'grant execute on function public.erase_user_data(uuid) to service_role';
    execute 'grant execute on function public.process_scheduled_deletions(integer) to service_role';
  end if;
end
$$;

-- ------------------------------------------------------------
-- Index supporting the cron scan.
-- ------------------------------------------------------------
create index if not exists users_deletion_scheduled_at_idx
  on public.users (deletion_scheduled_at)
  where deletion_scheduled_at is not null;
