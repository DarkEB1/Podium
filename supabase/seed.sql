-- ============================================================
-- DX-3 — LOCAL SEED DATA
--
-- Run automatically by `supabase db reset` / `supabase start`.
-- Every id is a FIXED uuid and every insert is ON CONFLICT DO NOTHING, so the
-- file can be re-run against an existing local database without duplicating.
--
-- REGRESSION TEST FOR B-1: this file NEVER inserts into public.matches.
-- The Northwind -> Maya connection request below is seeded with
-- status = 'accepted'; if the match-creation trigger from
-- 20260720001000_match_creation_trigger.sql is working, exactly one
-- public.matches row appears and the messages / proposal / contract seeded
-- underneath it resolve. If the trigger regresses, those inserts select zero
-- rows and the local inbox is empty — a loud, obvious failure.
--
-- Cast of characters
--   Maya Okafor      athlete  a1…  connected to Northwind (accepted -> match)
--   Tom Reyes        athlete  a2…  pending request from Northwind (no match)
--   Priya Nair       athlete  a3…  declined request from Northwind (no match)
--   Northwind Nutr.  brand    b1…  one active listing
-- Local login password for every seeded user: "podium-dev-password"
-- ============================================================

-- ------------------------------------------------------------
-- 1. Auth users. The on_auth_user_created trigger
--    (20260419000001_users_auth.sql) mirrors these into public.users.
-- ------------------------------------------------------------
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at,
  confirmation_token, recovery_token, email_change, email_change_token_new
)
values
  ('00000000-0000-0000-0000-000000000000',
   'a1111111-1111-4111-8111-111111111111',
   'authenticated', 'authenticated', 'maya.okafor@example.test',
   crypt('podium-dev-password', gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}', '{}',
   now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000',
   'a2222222-2222-4222-8222-222222222222',
   'authenticated', 'authenticated', 'tom.reyes@example.test',
   crypt('podium-dev-password', gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}', '{}',
   now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000',
   'a3333333-3333-4333-8333-333333333333',
   'authenticated', 'authenticated', 'priya.nair@example.test',
   crypt('podium-dev-password', gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}', '{}',
   now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000',
   'b1111111-1111-4111-8111-111111111111',
   'authenticated', 'authenticated', 'deals@northwind-nutrition.test',
   crypt('podium-dev-password', gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}', '{}',
   now(), now(), '', '', '', '')
on conflict (id) do nothing;

-- Safety net: if the auth trigger did not fire (e.g. rows pre-existed),
-- make sure the public.users mirror rows exist before anything references them.
insert into public.users (id, email)
select u.id, u.email
  from auth.users u
 where u.id in (
   'a1111111-1111-4111-8111-111111111111',
   'a2222222-2222-4222-8222-222222222222',
   'a3333333-3333-4333-8333-333333333333',
   'b1111111-1111-4111-8111-111111111111'
 )
on conflict (id) do nothing;

-- Roles are locked once chosen in the real onboarding flow.
update public.users
   set role = 'athlete',
       role_locked_at = coalesce(role_locked_at, now()),
       email_verified = true,
       terms_accepted_at = coalesce(terms_accepted_at, now()),
       terms_version = '1.0'
 where id in (
   'a1111111-1111-4111-8111-111111111111',
   'a2222222-2222-4222-8222-222222222222',
   'a3333333-3333-4333-8333-333333333333'
 );

update public.users
   set role = 'brand',
       role_locked_at = coalesce(role_locked_at, now()),
       email_verified = true,
       terms_accepted_at = coalesce(terms_accepted_at, now()),
       terms_version = '1.0'
 where id = 'b1111111-1111-4111-8111-111111111111';

-- ------------------------------------------------------------
-- 2. Athlete profiles
-- ------------------------------------------------------------
insert into public.athlete_profiles (
  id, user_id, status, display_name, full_legal_name, date_of_birth,
  primary_sport, position, level, years_active, notable_achievements,
  home_city, home_country, availability_status, seeking,
  performance_stats, social_accounts, profile_photo_url
)
values
  ('11111111-aaaa-4aaa-8aaa-111111111111',
   'a1111111-1111-4111-8111-111111111111',
   'active', 'Maya Okafor', 'Maya Chidinma Okafor', '1999-03-14',
   'Athletics', 'Sprinter', 'professional', 8,
   'National 200m champion 2025; European semi-finalist 2024.',
   'Manchester', 'United Kingdom', 'available_now',
   -- seeking is seeking_type[] since 20260616000001; 'brand_endorsement' /
   -- 'kit_sponsorship' were never enum labels and aborted `supabase db reset`
   -- at the first row, so nothing after this insert seeded at all.
   array['paid_partnership', 'apparel_deal']::public.seeking_type[],
   '{"pb_100m":"11.12","pb_200m":"22.48"}',
   '{"instagram":{"handle":"@mayaokafor","followers":48200}}',
   null),
  ('22222222-aaaa-4aaa-8aaa-222222222222',
   'a2222222-2222-4222-8222-222222222222',
   'active', 'Tom Reyes', 'Thomas Reyes', '2001-11-02',
   'Rugby Union', 'Fly-half', 'semi_professional', 5,
   'Championship top points scorer 2025.',
   'Bristol', 'United Kingdom', 'available_from',
   array['brand_ambassador']::public.seeking_type[],
   '{"appearances":74,"points":612}',
   '{"instagram":{"handle":"@tomreyes10","followers":15400}}',
   null),
  ('33333333-aaaa-4aaa-8aaa-333333333333',
   'a3333333-3333-4333-8333-333333333333',
   'active', 'Priya Nair', 'Priya Nair', '2003-06-21',
   'Swimming', 'Freestyle', 'amateur', 4,
   'University record holder, 400m freestyle.',
   'Leeds', 'United Kingdom', 'not_available',
   array['equipment_sponsorship']::public.seeking_type[],
   '{"pb_400_free":"4:18.9"}',
   '{"tiktok":{"handle":"@priyaswims","followers":9100}}',
   null)
on conflict (id) do nothing;

-- ------------------------------------------------------------
-- 3. Brand profile + listing
-- ------------------------------------------------------------
insert into public.brand_profiles (
  id, user_id, status, company_name, trading_name, industry, description,
  headquarters_city, headquarters_country, website_url, linkedin_url,
  seeking, target_sports, target_level, admin_approved_at
)
values
  ('bbbbbbbb-1111-4111-8111-111111111111',
   'b1111111-1111-4111-8111-111111111111',
   'active', 'Northwind Nutrition Ltd', 'Northwind', 'nutrition',
   'Performance nutrition for endurance and power athletes.',
   'Leeds', 'United Kingdom',
   'https://northwind-nutrition.test',
   'https://www.linkedin.com/company/northwind-nutrition-test',
   array['athlete_endorsement'],
   array['Athletics', 'Rugby Union', 'Swimming'],
   'professional',
   now())
on conflict (id) do nothing;

insert into public.job_listings (
  id, brand_id, type, status, title, description,
  sport_required, level_required, location, is_remote,
  pay_amount, pay_currency, pay_type, deliverables,
  contract_duration_months, application_deadline
)
values
  ('cccccccc-1111-4111-8111-111111111111',
   'bbbbbbbb-1111-4111-8111-111111111111',
   'athlete_endorsement', 'active',
   'Summer 2026 sprint ambassador',
   'Six-month ambassador deal around the summer track season.',
   'Athletics', 'professional', 'United Kingdom', true,
   6000, 'GBP', 'flat_fee',
   '{"instagram_posts":6,"appearances":2,"story_sets":12}',
   6, now() + interval '45 days')
on conflict (id) do nothing;

-- ------------------------------------------------------------
-- 4. Connection requests.
--
--    The ACCEPTED one is what exercises the B-1 trigger. Nothing below
--    inserts into public.matches by hand.
-- ------------------------------------------------------------
insert into public.connection_requests (
  id, sender_id, recipient_id, status, message, sent_at, responded_at
)
values
  -- accepted -> the B-1 trigger must create the match
  ('dddddddd-1111-4111-8111-111111111111',
   'b1111111-1111-4111-8111-111111111111',
   'a1111111-1111-4111-8111-111111111111',
   'accepted',
   'Hi Maya — we loved your 200m season. We are building a summer ambassador roster and would love to talk.',
   now() - interval '9 days',
   now() - interval '8 days'),
  -- pending -> deliberately produces NO match
  ('dddddddd-2222-4222-8222-222222222222',
   'b1111111-1111-4111-8111-111111111111',
   'a2222222-2222-4222-8222-222222222222',
   'pending',
   'Hi Tom — interested in talking about our rugby recovery range for next season?',
   now() - interval '3 days',
   null),
  -- declined -> deliberately produces NO match
  ('dddddddd-3333-4333-8333-333333333333',
   'b1111111-1111-4111-8111-111111111111',
   'a3333333-3333-4333-8333-333333333333',
   'declined',
   'Hi Priya — we are looking for swimmers for a hydration campaign this autumn.',
   now() - interval '6 days',
   now() - interval '5 days')
on conflict (id) do nothing;

-- The proposal card has been sent in this conversation, so free-text
-- messaging is unlocked (see the messages_insert policy).
update public.matches
   set proposal_sent = true
 where connection_request_id = 'dddddddd-1111-4111-8111-111111111111';

-- ------------------------------------------------------------
-- 5. Messages on the seeded match.
--
--    Selected FROM public.matches so they depend on the B-1 trigger having
--    created it.
-- ------------------------------------------------------------
insert into public.messages (
  id, match_id, sender_id, content_type, text_content, metadata, sent_at
)
select v.id, m.id, v.sender_id, v.content_type, v.text_content, v.metadata, v.sent_at
  from public.matches m
  cross join (
    values
      ('eeeeeeee-1111-4111-8111-111111111111'::uuid,
       'b1111111-1111-4111-8111-111111111111'::uuid,
       'proposal_card'::public.message_type,
       'Summer 2026 sprint ambassador — 6 months, £6,000.',
       '{"proposal_id":"ffffffff-1111-4111-8111-111111111111"}'::jsonb,
       now() - interval '7 days'),
      ('eeeeeeee-2222-4222-8222-222222222222'::uuid,
       'a1111111-1111-4111-8111-111111111111'::uuid,
       'text'::public.message_type,
       'Thanks! The deliverables look workable — can we talk about the appearance dates?',
       '{}'::jsonb,
       now() - interval '6 days'),
      ('eeeeeeee-3333-4333-8333-333333333333'::uuid,
       'b1111111-1111-4111-8111-111111111111'::uuid,
       'text'::public.message_type,
       'Of course. We are flexible either side of the national champs.',
       '{}'::jsonb,
       now() - interval '2 days')
  ) as v (id, sender_id, content_type, text_content, metadata, sent_at)
 where m.connection_request_id = 'dddddddd-1111-4111-8111-111111111111'
on conflict (id) do nothing;

-- Maya has read up to just before the brand's latest message, so her inbox
-- shows exactly one unread conversation (exercises L-3).
insert into public.message_reads (match_id, user_id, last_read_at)
select m.id, 'a1111111-1111-4111-8111-111111111111', now() - interval '4 days'
  from public.matches m
 where m.connection_request_id = 'dddddddd-1111-4111-8111-111111111111'
on conflict (match_id, user_id) do nothing;

-- ------------------------------------------------------------
-- 6. Proposal (accepted) + its contract with the DI-2 terms snapshot.
-- ------------------------------------------------------------
insert into public.proposals (
  id, match_id, sender_id, parent_proposal_id, status, title, deliverables,
  pay_amount, pay_currency, pay_type, timeline_start, timeline_end,
  usage_rights, additional_terms, responded_at
)
select 'ffffffff-1111-4111-8111-111111111111',
       m.id,
       'b1111111-1111-4111-8111-111111111111',
       null,
       'accepted',
       'Summer 2026 sprint ambassador',
       '{"instagram_posts":6,"appearances":2,"story_sets":12}',
       6000, 'GBP', 'flat_fee',
       date '2026-05-01', date '2026-10-31',
       '{"territories":["UK","EU"],"channels":["social","in_store"],"duration_months":12}',
       'Exclusive within performance nutrition for the contract term.',
       now() - interval '5 days'
  from public.matches m
 where m.connection_request_id = 'dddddddd-1111-4111-8111-111111111111'
on conflict (id) do nothing;

insert into public.contracts (
  id, proposal_id, match_id, brand_id, athlete_or_team_id, status, terms_snapshot
)
select '99999999-1111-4111-8111-111111111111',
       p.id,
       p.match_id,
       'b1111111-1111-4111-8111-111111111111',
       'a1111111-1111-4111-8111-111111111111',
       'pending_brand_signature',
       jsonb_build_object(
         'title',            p.title,
         'deliverables',     p.deliverables,
         'pay_amount',       p.pay_amount,
         'pay_currency',     p.pay_currency,
         'pay_type',         p.pay_type::text,
         'timeline_start',   p.timeline_start,
         'timeline_end',     p.timeline_end,
         'usage_rights',     p.usage_rights,
         'additional_terms', p.additional_terms,
         'snapshot_at',      p.responded_at
       )
  from public.proposals p
 where p.id = 'ffffffff-1111-4111-8111-111111111111'
on conflict (id) do nothing;

-- ------------------------------------------------------------
-- 7. A shortlist entry, so the brand's saved list is not empty.
-- ------------------------------------------------------------
insert into public.shortlists (user_id, target_user_id)
values ('b1111111-1111-4111-8111-111111111111',
        'a2222222-2222-4222-8222-222222222222')
on conflict (user_id, target_user_id) do nothing;
