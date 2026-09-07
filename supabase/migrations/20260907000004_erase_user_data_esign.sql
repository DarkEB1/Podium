-- ============================================================
-- Extend erase_user_data() to cover the in-house e-signature artefacts.
--
-- IMPORTANT: this create-or-replace reproduces the ENTIRE current function
-- body from 20260720005003_gdpr_erasure_hardening.sql (the latest full
-- redefinition; 20260720005004 and 20260720005007 only touch privileges and
-- an unrelated table, they do not redefine this function) UNCHANGED, and adds
-- two new statements inside it:
--
--   BLOCK A (new, placed right after the CONTRACTS anonymisation update,
--   alongside the other per-table anonymisation statements) — anonymises the
--   erased user's contract_signatures rows: signer_ip, signer_device and
--   signature_image_path are nulled and typed_name is replaced with
--   '[erased]'; signed_at and signature_hash are left untouched because they
--   are the tamper-evidence for the retained, anonymised contract.
--
--   BLOCK B (new, placed immediately after Block A) — mirrors the existing
--   contracts.document_url retention rule onto contracts.document_hash: both
--   are only nulled once retain_until has passed, for contracts where the
--   erased user was the brand, athlete/team or agent party.
--
--   BLOCK C (new, placed immediately after Block B) — deletes the actual
--   signed-PDF / signature-image storage objects under contracts/<id>/, once
--   the same retain_until rule allows it. document_url/document_hash only
--   point at these objects; nulling the columns without this delete would
--   leave the objects themselves in storage past retention.
--
-- No existing statement from 20260720005003 is dropped, reordered or altered.
-- ============================================================

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
  v_caller            uuid := auth.uid();
  v_is_service_role   boolean;
begin
  -- ==========================================================
  -- 0. AUTHORISATION (SEC-6 / defect A).
  --    The service role presents no JWT subject, so auth.uid() is NULL for it
  --    while current_setting('request.jwt.claims') carries role=service_role.
  --    A direct psql/cron session has neither, which we also allow (there is no
  --    HTTP caller to impersonate). Anything WITH a JWT identity must be the
  --    data subject or an admin.
  -- ==========================================================
  v_is_service_role := coalesce(
    current_setting('request.jwt.claims', true)::jsonb ->> 'role',
    ''
  ) = 'service_role';

  if v_caller is not null
     and not v_is_service_role
     and v_caller <> p_user_id
     and not public.is_admin() then
    raise exception 'Not authorised to erase this user' using errcode = 'PD011';
  end if;

  select email into v_email from public.users where id = p_user_id;

  if v_email is null then
    return jsonb_build_object('user_id', p_user_id, 'status', 'not_found');
  end if;

  if v_email like 'deleted-%@deleted.podium.invalid' then
    return jsonb_build_object('user_id', p_user_id, 'status', 'already_erased');
  end if;

  v_tombstone_email := 'deleted-' || p_user_id::text || '@deleted.podium.invalid';

  -- ==========================================================
  -- 1. STORAGE OBJECTS (defect I-a).
  --    `owner` is deprecated and is not populated for objects uploaded through
  --    a signed upload URL, so it cannot be the only predicate. The path
  --    convention `<auth.uid()>/<uuid>.<ext>` is enforced by the storage
  --    policies (20260720005002), which makes the first path segment a
  --    reliable owner key.
  -- ==========================================================
  if to_regclass('storage.objects') is not null then
    execute $store$
      delete from storage.objects
       where owner = $1
          or (storage.foldername(name))[1] = $1::text
    $store$ using p_user_id;
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

  delete from public.shortlists
    where user_id = p_user_id or target_user_id = p_user_id;
  delete from public.blocks
    where blocker_id = p_user_id or blocked_id = p_user_id;

  -- ==========================================================
  -- 3. REPORTS THAT POINT AT THE MESSAGES WE ARE ABOUT TO DELETE (defect C).
  --    MUST run before the message delete. Re-target onto the message author
  --    (the safety record is about a person, not a string), and drop the report
  --    only when no author survives to point at.
  -- ==========================================================
  update public.reports r
     set reported_user_id = msg.sender_id
    from public.messages msg
   where r.reported_message_id = msg.id
     and r.reported_user_id is null
     and msg.sender_id is not null
     and msg.match_id in (
       select id from public.matches
        where user_a_id = p_user_id or user_b_id = p_user_id
     );

  delete from public.reports r
   where r.reported_user_id is null
     and r.reported_message_id in (
       select msg.id
         from public.messages msg
        where msg.match_id in (
          select id from public.matches
           where user_a_id = p_user_id or user_b_id = p_user_id
        )
     );

  -- ==========================================================
  -- 4. MESSAGES
  -- ==========================================================
  delete from public.messages
   where match_id in (
     select id from public.matches
      where user_a_id = p_user_id or user_b_id = p_user_id
   );
  get diagnostics v_count = row_count;
  v_deleted := v_deleted || jsonb_build_object('messages', v_count);

  -- ==========================================================
  -- 5. MATCHES + CONNECTION REQUESTS
  -- ==========================================================
  update public.matches
     set connection_request_id = null
   where user_a_id = p_user_id or user_b_id = p_user_id;

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
  -- 6. PROPOSALS — strip free text, keep commercial terms.
  -- ==========================================================
  update public.proposals
     set additional_terms = null
   where sender_id = p_user_id
     and additional_terms is not null;
  get diagnostics v_count = row_count;
  v_deleted := v_deleted || jsonb_build_object('proposals_anonymised', v_count);

  -- ==========================================================
  -- 7. CONTRACTS — retained; signer IP/device cleared.
  -- ==========================================================
  update public.contracts
     set brand_signer_ip       = case when brand_id = p_user_id then null else brand_signer_ip end,
         brand_signer_device   = case when brand_id = p_user_id then null else brand_signer_device end,
         athlete_signer_ip     = case when athlete_or_team_id = p_user_id then null else athlete_signer_ip end,
         athlete_signer_device = case when athlete_or_team_id = p_user_id then null else athlete_signer_device end,
         agent_signer_ip       = case when agent_id = p_user_id then null else agent_signer_ip end,
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
  -- NEW BLOCK A (e-signature) — anonymise this user's signature audit rows,
  -- keeping the tamper-evidence fields (signed_at, signature_hash) intact.
  -- ==========================================================
  update public.contract_signatures
     set signer_ip = null,
         signer_device = null,
         signature_image_path = null,
         typed_name = '[erased]'
   where signer_user_id = p_user_id;
  get diagnostics v_count = row_count;
  v_deleted := v_deleted || jsonb_build_object('contract_signatures_anonymised', v_count);

  -- ==========================================================
  -- NEW BLOCK B (e-signature) — drop the signed-PDF hash only after retention
  -- expires, mirroring the document_url rule on public.contracts above.
  -- ==========================================================
  update public.contracts
     set document_hash = case when retain_until is not null and retain_until <= now()
                              then null else document_hash end
   where brand_id = p_user_id
      or athlete_or_team_id = p_user_id
      or agent_id = p_user_id;

  -- ==========================================================
  -- NEW BLOCK C (e-signature / GDPR spec-gap I3) — the signed PDF and any
  -- signature-image PNGs are the actual storage objects that document_url /
  -- document_hash (nulled above) and contract_signatures.signature_image_path
  -- (nulled in Block A) merely point at. Deleting the rows without deleting
  -- the objects leaves the personal data sitting in storage past retention,
  -- so remove the contract-scoped objects here, gated on the same
  -- retain_until rule as Block B.
  -- ==========================================================
  delete from storage.objects
   where bucket_id = 'docs'
     and (storage.foldername(name))[1] = 'contracts'
     and (storage.foldername(name))[2] in (
       select c.id::text from public.contracts c
       where (c.brand_id = p_user_id or c.athlete_or_team_id = p_user_id or c.agent_id = p_user_id)
         and c.retain_until is not null and c.retain_until <= now()
     );

  -- ==========================================================
  -- 8. PAYMENTS — receipt link dropped, figures retained.
  -- ==========================================================
  update public.payments
     set receipt_url = null
   where payer_id = p_user_id
      or payee_id = p_user_id;
  get diagnostics v_count = row_count;
  v_deleted := v_deleted || jsonb_build_object('payments_anonymised', v_count);

  -- ==========================================================
  -- 9. STRIPE WEBHOOK EVENTS (defect I-c) — anonymise, never delete.
  --    The row is Stripe's idempotency key and the forensic anchor of a
  --    retained payment; the payload is the only personal part of it.
  -- ==========================================================
  if to_regclass('public.stripe_webhook_events') is not null then
    update public.stripe_webhook_events
       set payload = null,
           error   = null
     where payload is not null
       and (
         payload::text like '%' || p_user_id::text || '%'
         or payload::text like '%' || v_email || '%'
       );
    get diagnostics v_count = row_count;
    v_deleted := v_deleted || jsonb_build_object('stripe_events_anonymised', v_count);
  end if;

  -- ==========================================================
  -- 10. REPRESENTATION LINKS / TEAM ADMINS (defect I-b).
  --     Invited-but-never-linked rows have user_id NULL and still carry
  --     invited_email + full_name, so they must be matched by email too.
  -- ==========================================================
  delete from public.representation_links where client_user_id = p_user_id;
  delete from public.team_admins
   where user_id = p_user_id
      or lower(invited_email) = lower(v_email);

  -- ==========================================================
  -- 11. ROLE PROFILES
  -- ==========================================================
  delete from public.athlete_profiles where user_id = p_user_id;
  delete from public.team_profiles    where user_id = p_user_id;
  delete from public.agent_profiles   where user_id = p_user_id;

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
  -- 12. REPORTS — free text cleared on closed reports.
  -- ==========================================================
  update public.reports
     set detail = null,
         admin_notes = null
   where (reporter_id = p_user_id or reported_user_id = p_user_id)
     and status in ('resolved', 'dismissed');

  -- ==========================================================
  -- 13. AUDIT LOGS — clear the user's own IP addresses.
  -- ==========================================================
  update public.audit_logs
     set ip_address = null
   where actor_id = p_user_id
     and ip_address is not null;

  -- ==========================================================
  -- 14. USERS — tombstone. deletion_requested_at is cleared too (defect I-d):
  --     leaving it set keeps a live "asked to be forgotten" flag on a row that
  --     is meant to identify nobody, and would make the request re-processable.
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
         deletion_requested_at    = null,
         deletion_scheduled_at    = null
   where id = p_user_id;

  -- ==========================================================
  -- 15. AUTH — scrub + permanent ban.
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
  -- 16. AUDIT ENTRY
  -- ==========================================================
  insert into public.audit_logs (actor_id, action, target_type, target_id, metadata)
  values (
    null,
    'gdpr_erasure_executed',
    'user',
    p_user_id,
    jsonb_build_object(
      'executed_at', now(),
      'policy', 'hard-delete personal data; anonymise contracts, proposals, payments, subscriptions, stripe webhook payloads, contract signatures',
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
  'GDPR Art. 17 erasure for a single user. SEC-6: refuses any JWT caller who is not the data subject, an admin or the service role (SQLSTATE PD011); re-targets message-only reports before deleting messages so reports_must_have_target cannot abort the run; deletes storage objects by path prefix as well as the deprecated owner column; deletes invited-but-unlinked team_admins by email; nulls stripe_webhook_events.payload referencing the user; clears deletion_requested_at on the tombstone; anonymises contract_signatures (keeping signed_at/signature_hash) and gates contracts.document_hash on retain_until, same as document_url; once retain_until has passed also deletes the underlying signed-PDF/signature-image objects under storage.objects (bucket docs, contracts/<id>/*).';
