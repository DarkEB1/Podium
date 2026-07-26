-- ============================================================
-- SEC-6 — GDPR ERASURE: AUTHORISATION, REPORT CONSTRAINT, STORAGE, TOMBSTONE
--
-- Supersedes the body of public.erase_user_data() from
-- 20260720003000_gdpr_erasure.sql (that file is left untouched). The EXECUTE
-- privileges for both erasure functions are revoked in
-- 20260720005004_function_privileges_lockdown.sql, which runs after this file
-- (CREATE OR REPLACE preserves a function's ACL, so the order is safe).
--
-- DEFECT A (critical) — defence in depth inside the function.
--   erase_user_data() performed unauthenticated, unauthorised, irreversible
--   destruction of ANY user id handed to it. The privilege fix is the primary
--   control, but a SECURITY DEFINER function this destructive must also refuse
--   on its own: it now hard-fails unless the caller is the service role (or an
--   admin, or the data subject themselves). Belt AND braces, because one bad
--   `grant execute ... to authenticated` anywhere re-opens the whole hole.
--
-- DEFECT C — erasure aborted for any user who was ever reported.
--   20260720003000:146-150 deletes the user's messages.
--   reports.reported_message_id is `on delete set null`
--   (20260419000008:9), and reports carries
--     constraint reports_must_have_target
--       check (reported_user_id is not null or reported_message_id is not null)
--   (20260419000008:18-19). A report filed against a MESSAGE ALONE therefore
--   fails that CHECK the moment the message is deleted. The exception was
--   swallowed by process_scheduled_deletions' `exception when others`, which
--   recorded status:'failed' — so erasure silently never completed for that
--   user and the GDPR clock kept running. Fixed by re-targeting such reports
--   onto the message's author BEFORE the messages are deleted, and deleting
--   the report outright when even that is impossible (author already gone).
--
-- DEFECT I — erasure gaps:
--   (a) storage objects were deleted by `owner`, a deprecated column that is
--       NOT reliably populated for objects created through
--       createSignedUploadUrl() — the exact path lib/storage/index.ts uses. So
--       the user's photos and media packs frequently survived erasure. Now
--       matched on the path convention `<uid>/<uuid>.<ext>` as well as owner.
--   (b) team_admins rows for an INVITED-but-never-linked admin have user_id
--       NULL yet still hold invited_email and full_name — personal data that
--       the `where user_id = p_user_id` delete never touched. Now also deleted
--       by the user's (pre-tombstone) email.
--   (c) stripe_webhook_events.payload embeds the customer's email, name and
--       billing address and was absent from the per-table policy entirely.
--       DECISION: ANONYMISE, do not delete. The row is the idempotency key for
--       Stripe's 3-day retry window and the forensic record behind a retained
--       financial transaction, so the row and its status must survive; the
--       payload is only needed for replay/debugging, so it is nulled for events
--       whose payload references the erased user. Matching is done on the JSON
--       text because the payload shape varies per event type.
--   (d) users.deletion_requested_at was left set on the tombstone (only
--       deletion_scheduled_at was cleared), leaving a live "this person asked
--       to be deleted" flag against a row that is supposed to identify nobody.
--       Now cleared too.
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
      'policy', 'hard-delete personal data; anonymise contracts, proposals, payments, subscriptions, stripe webhook payloads',
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
  'GDPR Art. 17 erasure for a single user. SEC-6: refuses any JWT caller who is not the data subject, an admin or the service role (SQLSTATE PD011); re-targets message-only reports before deleting messages so reports_must_have_target cannot abort the run; deletes storage objects by path prefix as well as the deprecated owner column; deletes invited-but-unlinked team_admins by email; nulls stripe_webhook_events.payload referencing the user; clears deletion_requested_at on the tombstone.';
