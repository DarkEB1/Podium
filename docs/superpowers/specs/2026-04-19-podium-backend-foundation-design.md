# Podium Backend — Foundation Design

**Date:** 2026-04-19  
**Subsystem:** 1 of 8 — Foundation  
**Scope:** DB schema + RLS + `lib/supabase/auth.ts` + auth API routes + API contract docs  
**Status:** Approved — pending implementation

---

## Overview

Foundation lays everything the rest of the backend builds on:

1. **8 migration files** — all 17 spec tables (+ `notification_logs`, + `blocks`) with enums and RLS policies, defined before any product code touches the DB
2. **`lib/supabase/auth.ts`** — server-side functions wrapping Supabase auth
3. **Auth API routes** — `app/api/auth/` handlers for sign-up, login, logout, role selection, password reset/update, session
4. **API contract doc** — `docs/api/01-auth.md` listing every endpoint with request/response shapes and error codes

All other tables (profiles, discovery, messaging, deals, payments, notifications, admin) are schema-only in Foundation — tables exist with RLS, but no lib/ functions or API routes until that subsystem's phase.

---

## Subsystem Map

| # | Subsystem | Foundation delivers |
|---|---|---|
| 1 | Foundation | Schema + RLS + auth lib + auth API + docs |
| 2 | Profiles | `lib/supabase/profiles.ts` + profile API routes + `docs/api/02-profiles.md` |
| 3 | Discovery | `lib/supabase/discovery.ts` + discovery API routes + `docs/api/03-discovery.md` |
| 4 | Messaging | `lib/supabase/messaging.ts` + messaging API routes + `docs/api/04-messaging.md` |
| 5 | Deals | `lib/supabase/deals.ts` + deals API routes + `docs/api/05-deals.md` |
| 6 | Payments | `lib/supabase/payments.ts` + payments API routes + `docs/api/06-payments.md` |
| 7 | Notifications | `lib/supabase/notifications.ts` + notification API routes + `docs/api/07-notifications.md` |
| 8 | Admin | `lib/supabase/admin.ts` + admin API routes + `docs/api/08-admin.md` |

---

## File Layout

```
supabase/migrations/
  01-users-auth.sql
  02-profiles.sql
  03-discovery.sql
  04-messaging.sql
  05-deals.sql
  06-payments.sql
  07-notifications.sql
  08-admin.sql

lib/supabase/
  auth.ts          ← Foundation builds this
  profiles.ts      ← Phase 2
  discovery.ts     ← Phase 3
  messaging.ts     ← Phase 4
  deals.ts         ← Phase 5
  payments.ts      ← Phase 6
  notifications.ts ← Phase 7
  admin.ts         ← Phase 8

app/api/auth/
  signup/route.ts
  login/route.ts
  logout/route.ts
  callback/route.ts
  password-reset/route.ts
  password-update/route.ts
  role/route.ts
  me/route.ts

docs/api/
  01-auth.md       ← Foundation builds this
  02-profiles.md   ← Phase 2
  ...
```

---

## Database Schema

### Enums (defined in `01-users-auth.sql`, used across all migrations)

```sql
user_role:            athlete | team | brand | agent | admin
profile_status:       draft | pending_review | active | deactivated
brand_status:         pending_approval | active | suspended | rejected
ui_mode:              marketplace | swipe
display_theme:        light | dark
athlete_level:        recreational | amateur | semi_professional | professional | international
team_level:           grassroots | college | semi_pro | professional | international
brand_industry:       sport | fashion | nutrition | technology | financial | travel | entertainment | fmcg | other
availability_status:  available_now | available_from | not_available
fan_reach:            local | regional | national | international
link_status:          pending | active | terminated
listing_type:         athlete_endorsement | team_sponsorship
listing_status:       draft | active | paused | expired | filled
pay_type:             flat_fee | monthly_retainer | per_post | revenue_share
connection_status:    pending | accepted | declined | withdrawn
match_status:         active | archived | blocked
message_type:         text | image | video | document | proposal_card | esignature_request | payment_confirmation
proposal_status:      pending | accepted | declined | countered | withdrawn
contract_status:      draft | pending_brand_signature | pending_athlete_signature | fully_signed | terminated
subscription_status:  trialing | active | past_due | canceled | paused
payment_status:       pending | processing | succeeded | failed | refunded
notification_channel: push | email | in_app
report_reason:        fake_profile | inappropriate_content | harassment | spam | underage_concern | other
report_status:        pending | under_review | resolved | dismissed
```

---

### `01-users-auth.sql` — `users`

Mirrors `auth.users`. Populated by trigger on `auth.users` INSERT. Role and legal metadata live here.

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid PK` | FK → `auth.users.id` |
| `email` | `text NOT NULL` | |
| `role` | `user_role` | NULL until role selection |
| `role_locked_at` | `timestamptz` | NULL until role confirmed; UPDATE blocked by RLS once set |
| `email_verified` | `boolean DEFAULT false` | Set true by auth callback |
| `terms_accepted_at` | `timestamptz` | |
| `terms_version` | `text` | |
| `privacy_accepted_at` | `timestamptz` | |
| `privacy_version` | `text` | |
| `deactivated_at` | `timestamptz` | NULL = active |
| `deletion_requested_at` | `timestamptz` | |
| `deletion_scheduled_at` | `timestamptz` | = `deletion_requested_at + 14 days` |
| `data_export_requested_at` | `timestamptz` | |
| `created_at` | `timestamptz DEFAULT now()` | |
| `updated_at` | `timestamptz DEFAULT now()` | |

---

### `02-profiles.sql`

#### `athlete_profiles`

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid PK` | |
| `user_id` | `uuid UNIQUE` | FK → `users.id` |
| `status` | `profile_status DEFAULT 'draft'` | |
| `display_name` | `text` | Public |
| `full_legal_name` | `text` | Private |
| `date_of_birth` | `date` | Private; used to compute `is_under_18` |
| `is_under_18` | `boolean` | Computed by trigger from DOB |
| `height_cm` | `integer` | Optional |
| `weight_kg` | `numeric` | Optional |
| `phone` | `text` | Private |
| `profile_photo_url` | `text` | Required before profile goes live |
| `primary_sport` | `text` | |
| `secondary_sport` | `text` | Optional |
| `position` | `text` | Optional |
| `level` | `athlete_level` | |
| `years_active` | `integer` | Optional |
| `notable_achievements` | `text` | Optional |
| `performance_stats` | `jsonb DEFAULT '{}'` | Sport-specific; e.g. `{goals: 12, assists: 5}` |
| `social_accounts` | `jsonb DEFAULT '{}'` | `{instagram: {handle, followers, verified}}` — no tokens |
| `home_city` | `text` | Public (city-level only) |
| `home_country` | `text` | Public |
| `travel_radius_km` | `integer` | 0/25/50/100/200; NULL=nationwide; -1=international |
| `availability_status` | `availability_status` | |
| `available_from_date` | `date` | Optional |
| `has_agent` | `boolean DEFAULT false` | |
| `guardian_name` | `text` | Under-18 only |
| `guardian_relationship` | `text` | Under-18 only |
| `guardian_email` | `text` | Under-18 only |
| `guardian_phone` | `text` | Under-18 only |
| `guardian_accepted_at` | `timestamptz` | NULL = consent pending |
| `seeking` | `text[]` | `['brand_deals', 'agent_representation']` |
| `discovery_ui_mode` | `ui_mode DEFAULT 'marketplace'` | |
| `display_theme` | `display_theme DEFAULT 'light'` | |
| `chat_retention_days` | `integer` | NULL = manual only |
| `notification_prefs` | `jsonb DEFAULT '{}'` | Per-event, per-channel config |
| `last_active_at` | `timestamptz` | |
| `created_at` | `timestamptz DEFAULT now()` | |
| `updated_at` | `timestamptz DEFAULT now()` | |

#### `team_profiles`

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid PK` | |
| `user_id` | `uuid UNIQUE` | FK → `users.id` |
| `status` | `profile_status DEFAULT 'draft'` | |
| `team_name` | `text` | |
| `nickname` | `text` | Optional |
| `sports` | `text[]` | |
| `competition_level` | `team_level` | |
| `year_founded` | `integer` | Optional |
| `logo_url` | `text` | Min 300×300px |
| `cover_photo_url` | `text` | Min 1200×600px |
| `bio` | `text` | Max 500 chars |
| `home_city` | `text` | |
| `home_country` | `text` | |
| `home_venue` | `text` | Optional |
| `match_day_attendance` | `integer` | Optional |
| `fan_reach` | `fan_reach` | |
| `social_accounts` | `jsonb DEFAULT '{}'` | |
| `total_social_following` | `integer DEFAULT 0` | Auto-summed |
| `press_mentions` | `text` | Optional |
| `seeking_sponsorship_types` | `text[]` | kit/travel/event/facility/general |
| `total_sponsorship_value_sought` | `numeric` | Annual, optional |
| `sponsorship_brief_url` | `text` | PDF upload, optional |
| `offers_to_sponsors` | `jsonb DEFAULT '{}'` | Logo placement, signage, social posts, etc. |
| `commercial_manager_name` | `text` | Optional |
| `commercial_manager_email` | `text` | Optional |
| `commercial_manager_phone` | `text` | Optional |
| `primary_controller_name` | `text` | |
| `primary_controller_role` | `text` | |
| `primary_controller_email` | `text` | |
| `primary_controller_phone` | `text` | |
| `discovery_ui_mode` | `ui_mode DEFAULT 'marketplace'` | |
| `display_theme` | `display_theme DEFAULT 'light'` | |
| `notification_prefs` | `jsonb DEFAULT '{}'` | |
| `created_at` | `timestamptz DEFAULT now()` | |
| `updated_at` | `timestamptz DEFAULT now()` | |

#### `brand_profiles`

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid PK` | |
| `user_id` | `uuid UNIQUE` | FK → `users.id` |
| `status` | `brand_status DEFAULT 'pending_approval'` | |
| `company_name` | `text NOT NULL` | |
| `trading_name` | `text` | Optional |
| `industry` | `brand_industry` | |
| `description` | `text` | Max 600 chars |
| `headquarters_city` | `text` | |
| `headquarters_country` | `text` | |
| `website_url` | `text` | |
| `linkedin_url` | `text NOT NULL` | Required per spec |
| `social_accounts` | `jsonb DEFAULT '{}'` | |
| `logo_url` | `text` | Min 300×300px |
| `cover_image_url` | `text` | Optional |
| `seeking` | `text[]` | endorsement/content/appearance/kit/event/ambassador |
| `target_sports` | `text[]` | Max 5 |
| `target_level` | `text` | Optional |
| `geographic_preference` | `text` | Optional |
| `company_registration_number` | `text` | For business verification |
| `vat_number` | `text` | Optional alternative |
| `admin_approved_at` | `timestamptz` | |
| `admin_approved_by` | `uuid` | FK → `users.id` |
| `rejection_reason` | `text` | Optional |
| `discovery_ui_mode` | `ui_mode DEFAULT 'marketplace'` | |
| `display_theme` | `display_theme DEFAULT 'light'` | |
| `notification_prefs` | `jsonb DEFAULT '{}'` | |
| `created_at` | `timestamptz DEFAULT now()` | |
| `updated_at` | `timestamptz DEFAULT now()` | |

#### `agent_profiles`

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid PK` | |
| `user_id` | `uuid UNIQUE` | FK → `users.id` |
| `status` | `profile_status DEFAULT 'draft'` | |
| `agency_name` | `text` | |
| `agent_full_name` | `text` | |
| `years_in_industry` | `integer` | Optional |
| `sports_specialisms` | `text[]` | Max 5 |
| `geographic_regions` | `text[]` | |
| `bio` | `text` | Max 500 chars |
| `logo_url` | `text` | Optional |
| `website_url` | `text` | Optional |
| `linkedin_url` | `text` | Optional |
| `services_offered` | `text[]` | representation/commercial/brokerage/contracts/media/financial |
| `commission_rate_display` | `text` | Informational only, e.g. "10–15%" |
| `is_verified` | `boolean DEFAULT false` | Verification badge |
| `verified_at` | `timestamptz` | Optional |
| `discovery_ui_mode` | `ui_mode DEFAULT 'marketplace'` | |
| `display_theme` | `display_theme DEFAULT 'light'` | |
| `notification_prefs` | `jsonb DEFAULT '{}'` | |
| `created_at` | `timestamptz DEFAULT now()` | |
| `updated_at` | `timestamptz DEFAULT now()` | |

#### `representation_links`

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid PK` | |
| `agent_id` | `uuid` | FK → `agent_profiles.id` |
| `client_user_id` | `uuid` | FK → `users.id` |
| `client_role` | `user_role` | `athlete` or `team` only |
| `status` | `link_status DEFAULT 'pending'` | |
| `can_edit_profile` | `boolean DEFAULT false` | |
| `can_message` | `boolean DEFAULT false` | |
| `can_sign_contracts` | `boolean DEFAULT false` | |
| `commission_rate` | `text` | Optional, private |
| `contract_duration_months` | `integer` | Optional |
| `requested_at` | `timestamptz DEFAULT now()` | |
| `accepted_at` | `timestamptz` | Optional |
| `terminated_at` | `timestamptz` | Optional |
| `termination_reason` | `text` | Optional |
| `created_at` | `timestamptz DEFAULT now()` | |
| `updated_at` | `timestamptz DEFAULT now()` | |

---

### `03-discovery.sql`

#### `job_listings`

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid PK` | |
| `brand_id` | `uuid` | FK → `brand_profiles.id` |
| `type` | `listing_type` | |
| `status` | `listing_status DEFAULT 'draft'` | |
| `title` | `text` | |
| `description` | `text` | |
| `sport_required` | `text` | |
| `level_required` | `text` | Optional |
| `location` | `text` | Optional |
| `is_remote` | `boolean DEFAULT false` | |
| `pay_amount` | `numeric` | Optional |
| `pay_currency` | `text DEFAULT 'GBP'` | |
| `pay_type` | `pay_type` | |
| `deliverables` | `jsonb DEFAULT '{}'` | |
| `contract_duration_months` | `integer` | Optional |
| `usage_rights` | `jsonb` | Optional |
| `application_deadline` | `timestamptz` | Optional |
| `multiple_hires` | `boolean DEFAULT false` | |
| `max_hires` | `integer` | Optional |
| `total_sponsorship_budget` | `numeric` | Team listings only |
| `sponsorship_structure` | `text` | Team listings only |
| `what_expected` | `jsonb` | Team listings only |
| `exclusivity_required` | `boolean DEFAULT false` | |
| `number_of_teams_sought` | `integer` | Optional |
| `created_at` | `timestamptz DEFAULT now()` | |
| `updated_at` | `timestamptz DEFAULT now()` | |

#### `connection_requests`

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid PK` | |
| `sender_id` | `uuid` | FK → `users.id` |
| `recipient_id` | `uuid` | FK → `users.id` |
| `status` | `connection_status DEFAULT 'pending'` | |
| `message` | `text NOT NULL` | Max 300 chars; required per spec |
| `sent_at` | `timestamptz DEFAULT now()` | |
| `responded_at` | `timestamptz` | Optional |
| `created_at` | `timestamptz DEFAULT now()` | |
| `updated_at` | `timestamptz DEFAULT now()` | |

#### `matches`

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid PK` | |
| `user_a_id` | `uuid` | FK → `users.id` |
| `user_b_id` | `uuid` | FK → `users.id` |
| `connection_request_id` | `uuid` | FK → `connection_requests.id`; optional (swipe match) |
| `status` | `match_status DEFAULT 'active'` | |
| `proposal_required` | `boolean DEFAULT true` | Brand must send proposal before free-text |
| `proposal_sent` | `boolean DEFAULT false` | Flipped when first proposal card sent |
| `matched_at` | `timestamptz DEFAULT now()` | |
| `created_at` | `timestamptz DEFAULT now()` | |
| `updated_at` | `timestamptz DEFAULT now()` | |
| — | `UNIQUE(user_a_id, user_b_id)` | |

#### `shortlists`

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid PK` | |
| `user_id` | `uuid` | FK → `users.id` |
| `target_user_id` | `uuid` | FK → `users.id` |
| `created_at` | `timestamptz DEFAULT now()` | |
| — | `UNIQUE(user_id, target_user_id)` | |

#### `blocks`

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid PK` | |
| `blocker_id` | `uuid` | FK → `users.id` |
| `blocked_id` | `uuid` | FK → `users.id` |
| `created_at` | `timestamptz DEFAULT now()` | |
| — | `UNIQUE(blocker_id, blocked_id)` | |

---

### `04-messaging.sql` — `messages`

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid PK` | |
| `match_id` | `uuid` | FK → `matches.id` |
| `sender_id` | `uuid` | FK → `users.id` |
| `content_type` | `message_type` | |
| `text_content` | `text` | Optional |
| `attachment_url` | `text` | Optional |
| `attachment_size_bytes` | `bigint` | Optional |
| `attachment_mime_type` | `text` | Optional |
| `metadata` | `jsonb DEFAULT '{}'` | Proposal/esignature/payment card payloads |
| `is_deleted` | `boolean DEFAULT false` | Soft-delete only |
| `deleted_at` | `timestamptz` | Optional |
| `sent_at` | `timestamptz DEFAULT now()` | |
| `created_at` | `timestamptz DEFAULT now()` | |

---

### `05-deals.sql`

#### `proposals`

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid PK` | |
| `match_id` | `uuid` | FK → `matches.id` |
| `sender_id` | `uuid` | FK → `users.id` |
| `parent_proposal_id` | `uuid` | FK → `proposals.id`; NULL for first proposal; set for counter-proposals |
| `status` | `proposal_status DEFAULT 'pending'` | |
| `title` | `text` | |
| `deliverables` | `jsonb` | |
| `pay_amount` | `numeric` | |
| `pay_currency` | `text DEFAULT 'GBP'` | |
| `pay_type` | `pay_type` | |
| `timeline_start` | `date` | Optional |
| `timeline_end` | `date` | Optional |
| `usage_rights` | `jsonb` | Optional |
| `additional_terms` | `text` | Optional |
| `responded_at` | `timestamptz` | Optional |
| `created_at` | `timestamptz DEFAULT now()` | |
| `updated_at` | `timestamptz DEFAULT now()` | |

#### `contracts`

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid PK` | |
| `proposal_id` | `uuid` | FK → `proposals.id` |
| `match_id` | `uuid` | FK → `matches.id` |
| `brand_id` | `uuid` | FK → `users.id` |
| `athlete_or_team_id` | `uuid` | FK → `users.id` |
| `agent_id` | `uuid` | FK → `users.id`; optional |
| `status` | `contract_status DEFAULT 'draft'` | |
| `document_url` | `text` | Storage URL |
| `brand_signed_at` | `timestamptz` | Optional |
| `brand_signer_ip` | `text` | Optional |
| `brand_signer_device` | `text` | Optional |
| `athlete_signed_at` | `timestamptz` | Optional |
| `athlete_signer_ip` | `text` | Optional |
| `athlete_signer_device` | `text` | Optional |
| `agent_signed_at` | `timestamptz` | Optional |
| `agent_signer_ip` | `text` | Optional |
| `esignature_provider` | `text` | `'docusign'` or `'hellosign'` |
| `esignature_envelope_id` | `text` | Optional |
| `locked_at` | `timestamptz` | Set when both parties sign |
| `terminated_at` | `timestamptz` | Optional |
| `termination_reason` | `text` | Optional |
| `retain_until` | `timestamptz` | `locked_at + 7 years`; set by trigger |
| `created_at` | `timestamptz DEFAULT now()` | |
| `updated_at` | `timestamptz DEFAULT now()` | |

---

### `06-payments.sql`

#### `subscriptions`

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid PK` | |
| `brand_id` | `uuid UNIQUE` | FK → `brand_profiles.id` |
| `stripe_customer_id` | `text` | |
| `stripe_subscription_id` | `text` | |
| `tier` | `integer` | 1, 2, or 3 |
| `status` | `subscription_status` | |
| `trial_ends_at` | `timestamptz` | Optional |
| `current_period_start` | `timestamptz` | |
| `current_period_end` | `timestamptz` | |
| `canceled_at` | `timestamptz` | Optional |
| `cancellation_scheduled_at` | `timestamptz` | Optional |
| `created_at` | `timestamptz DEFAULT now()` | |
| `updated_at` | `timestamptz DEFAULT now()` | |

#### `payments`

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid PK` | |
| `contract_id` | `uuid` | FK → `contracts.id` |
| `payer_id` | `uuid` | FK → `users.id` (brand) |
| `payee_id` | `uuid` | FK → `users.id` (athlete/team) |
| `stripe_payment_intent_id` | `text` | |
| `amount` | `numeric` | |
| `currency` | `text DEFAULT 'GBP'` | |
| `status` | `payment_status DEFAULT 'pending'` | |
| `receipt_url` | `text` | Optional |
| `stripe_fee` | `numeric` | Optional |
| `platform_fee` | `numeric` | Optional |
| `net_amount` | `numeric` | Optional |
| `processed_at` | `timestamptz` | Optional |
| `tax_disclaimer_shown` | `boolean DEFAULT false` | First-payment flag |
| `created_at` | `timestamptz DEFAULT now()` | |
| `updated_at` | `timestamptz DEFAULT now()` | |

---

### `07-notifications.sql` — `notification_logs`

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid PK` | |
| `user_id` | `uuid` | FK → `users.id` |
| `event_type` | `text` | e.g. `connection_request_received`, `payment_received` |
| `channel` | `notification_channel` | |
| `title` | `text` | |
| `body` | `text` | |
| `metadata` | `jsonb DEFAULT '{}'` | |
| `sent_at` | `timestamptz DEFAULT now()` | |
| `read_at` | `timestamptz` | Optional; in-app only |
| `created_at` | `timestamptz DEFAULT now()` | |

---

### `08-admin.sql`

#### `reports`

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid PK` | |
| `reporter_id` | `uuid` | FK → `users.id` |
| `reported_user_id` | `uuid` | FK → `users.id`; optional |
| `reported_message_id` | `uuid` | FK → `messages.id`; optional |
| `reason` | `report_reason` | |
| `detail` | `text` | Optional |
| `status` | `report_status DEFAULT 'pending'` | |
| `admin_notes` | `text` | Optional |
| `resolved_by` | `uuid` | FK → `users.id`; optional |
| `resolved_at` | `timestamptz` | Optional |
| `created_at` | `timestamptz DEFAULT now()` | |
| `updated_at` | `timestamptz DEFAULT now()` | |

#### `audit_logs`

Append-only. No UPDATE or DELETE permitted by any role.

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid PK` | |
| `actor_id` | `uuid` | FK → `users.id`; NULL for system actions |
| `action` | `text` | e.g. `user.suspended`, `chat.accessed_by_admin` |
| `target_type` | `text` | `user`, `profile`, `message`, `contract`, etc. |
| `target_id` | `uuid` | |
| `metadata` | `jsonb DEFAULT '{}'` | |
| `ip_address` | `text` | Optional |
| `created_at` | `timestamptz DEFAULT now()` | |

---

## RLS Policy Strategy

### `users`
- `SELECT`: own row only (`auth.uid() = id`)
- `UPDATE`: own row; blocked on `role` column once `role_locked_at IS NOT NULL`
- `INSERT`: blocked — trigger-only population from `auth.users`
- Service role: unrestricted

### `athlete_profiles`, `team_profiles`, `agent_profiles`
- `SELECT`: public reads `status = 'active'` rows; owner reads own regardless of status
- `INSERT` / `UPDATE`: owner only (`user_id = auth.uid()`)
- `DELETE`: none — use `status = 'deactivated'`

### `brand_profiles`
- `SELECT`: public reads `status = 'active'`; owner reads own; admin reads all
- `INSERT`: owner only
- `UPDATE`: owner for profile fields; `status`, `admin_approved_at`, `admin_approved_by` — admin only

### `representation_links`
- `SELECT`: agent or client party only
- `INSERT`: agent only
- `UPDATE`: agent or client (permission grants); status changes logged to `audit_logs`

### `job_listings`
- `SELECT`: any authenticated user for `status = 'active'`; brand owner reads own drafts
- `INSERT` / `UPDATE`: brand owner only

### `connection_requests`
- `SELECT`: sender or recipient only
- `INSERT`: authenticated user (not blocked, not duplicate)
- `UPDATE` (status only): recipient (accept/decline); sender (withdraw)

### `matches`
- `SELECT`: either participant
- `INSERT`: service role only (trigger on connection request accepted)
- `UPDATE`: participants only

### `shortlists`
- `SELECT` / `INSERT` / `DELETE`: owner only

### `blocks`
- `SELECT`: blocker reads own blocks; blocked user cannot see that they are blocked
- `INSERT`: any authenticated user (cannot block yourself)
- `DELETE`: blocker only (unblock)
- Admin: reads all via service role

### `messages`
- `SELECT`: match participants; `is_deleted = true` rows — admin only
- `INSERT`: match participant; only if `proposal_sent = true` OR `content_type = 'proposal_card'`
- `UPDATE`: sender only; soft-delete fields only (`is_deleted`, `deleted_at`)

### `proposals`
- `SELECT`: match participants only
- `INSERT`: brand participant only
- `UPDATE` (status): recipient (accept/decline/counter); sender (withdraw)

### `contracts`
- `SELECT`: brand + athlete/team + agent (if `agent_id` matches) + admin
- `INSERT` / `UPDATE`: service role only (e-signature webhook)
- `DELETE`: none

### `subscriptions`, `payments`
- `SELECT`: brand owner (own records); admin (all)
- `INSERT` / `UPDATE`: service role only (Stripe webhook)

### `notification_logs`
- `SELECT`: own notifications only
- `INSERT`: service role only
- No UPDATE / DELETE

### `reports`
- `SELECT`: reporter reads own; admin reads all
- `INSERT`: any authenticated user
- `UPDATE`: admin only

### `audit_logs`
- `SELECT`: admin only
- `INSERT`: service role only
- No UPDATE, no DELETE — enforced by RLS

---

## Auth lib — `lib/supabase/auth.ts`

| Function | Signature | Purpose |
|---|---|---|
| `getSession` | `(request: Request) => Promise<Session \| null>` | Extract and validate session from cookies |
| `getUser` | `(supabase: SupabaseClient) => Promise<User \| null>` | Fetch current user from `public.users` |
| `lockRole` | `(supabase, userId, role) => Promise<void>` | Set role + `role_locked_at`; throws `ROLE_ALREADY_LOCKED` if locked |
| `acceptTerms` | `(supabase, userId, tcVersion, ppVersion) => Promise<void>` | Write `terms_accepted_at`, `privacy_accepted_at`, versions |
| `requestDeletion` | `(supabase, userId) => Promise<void>` | Set `deletion_requested_at`; schedule `deletion_scheduled_at = +14 days` |

---

## Auth API Routes

### Surface Summary

| Method | Path | Auth | Description |
|---|---|---|---|
| `POST` | `/api/auth/signup` | — | Register with email + password |
| `POST` | `/api/auth/login` | — | Sign in; sets session cookie |
| `POST` | `/api/auth/logout` | required | Clear session |
| `GET` | `/api/auth/callback` | — | Supabase redirect handler for email verify + password reset |
| `POST` | `/api/auth/password-reset` | — | Request password reset link |
| `POST` | `/api/auth/password-update` | recovery session | Set new password |
| `POST` | `/api/auth/role` | required | Permanently lock user role |
| `GET` | `/api/auth/me` | required | Return current user row |

### Password Rules (enforced server-side)
- Minimum 8 characters
- At least 1 uppercase letter
- At least 1 number
- At least 1 symbol

### Enumeration Protection
- `POST /api/auth/signup` — always returns `{ message: "Check your email to verify your account" }`
- `POST /api/auth/password-reset` — always returns `{ message: "If this email exists, you will receive a reset link" }`

### `GET /api/auth/me` — Response shape

```ts
{
  id: string
  email: string
  role: 'athlete' | 'team' | 'brand' | 'agent' | 'admin' | null
  role_locked_at: string | null    // null = role not yet selected
  email_verified: boolean
  terms_accepted_at: string | null
  deactivated_at: string | null
  deletion_scheduled_at: string | null
}
```

The UI uses `role === null || role_locked_at === null` to show the role selection screen on first login.

### Error Code Conventions

All error responses return:
```ts
{ error: { code: string, message: string } }
```

Error codes are string constants — the UI pattern-matches on `code`, not HTTP status alone.

### `/api/auth/callback` Behaviour

Handles two Supabase redirect types via the `type` query param:
- `email_confirmation` — exchanges code for session; redirects to role selection or dashboard
- `recovery` — exchanges code for recovery session; redirects to password update page

---

## API Documentation Format

Each `docs/api/0N-<domain>.md` file opens with a surface summary table (method, path, auth, one-line description), then one full entry per endpoint:

```markdown
## POST /api/auth/role

**Auth:** Session cookie required
**Description:** Permanently locks the authenticated user's role. Can only be called once per account.

**Request body:**
{ "role": "athlete" | "team" | "brand" | "agent" }

**Success 200:**
{ "role": "athlete" }

**Errors:**
| Status | Code | Meaning |
|--------|------|---------|
| 400 | ROLE_ALREADY_LOCKED | Role was previously set — cannot be changed |
| 400 | INVALID_ROLE | Value not in allowed enum |
| 401 | UNAUTHENTICATED | No valid session |
```

Foundation delivers `docs/api/01-auth.md`. Each subsequent subsystem phase delivers its own doc.
