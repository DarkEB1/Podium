---
plan: docs/superpowers/specs/2026-04-19-podium-backend-foundation-design.md
task: subsystem 7 of 8 complete
status: complete
last_updated: 2026-04-20T19:50:00Z
head_sha: db5820a
---

<current_state>
Subsystem 7: Notifications is COMPLETE and committed. Ready to start Subsystem 8: Admin.
</current_state>

<completed_work>
- Subsystem 1 (Foundation): 8 migration files, 19 tables, RLS, auth lib, 8 auth API routes, docs/api/01-auth.md
- Subsystem 2 (Profiles): lib/supabase/profiles.ts (8 functions), 8 API routes, 120 passing Vitest tests, e2e/profiles.spec.ts, docs/api/02-profiles.md
- Subsystem 3 (Discovery): lib/supabase/discovery.ts (14 functions), 9 API route handlers, 226 passing tests, e2e/discovery.spec.ts, docs/api/03-discovery.md
- Subsystem 4 (Messaging): lib/supabase/messaging.ts (4 functions), 4 API routes, 269 passing tests, e2e/messaging.spec.ts, docs/api/04-messaging.md
- Subsystem 5 (Deals): lib/supabase/deals.ts (6 functions), 5 route files, 339 passing tests, e2e/deals.spec.ts, docs/api/05-deals.md
- Subsystem 6 (Payments): 419 total passing tests, docs/api/06-payments.md, e2e/payments.spec.ts
  - lib/stripe/index.ts: lazy Stripe client, createCheckoutSession (7-day trial), createPaymentIntent (idempotency key pi_{contractId}), cancelSubscription (update cancel_at_period_end=true), constructWebhookEvent
  - lib/supabase/payments.ts: getSubscription, getSubscriptionForUser (joins brand_profiles by user_id), upsertSubscription, updateSubscription, getPayment, getPaymentHistory, createPaymentRecord, updatePaymentRecord, getContractForPayment
  - 6 API routes under app/api/payments/: subscriptions/me (GET), subscriptions/checkout (POST), subscriptions/cancel (POST), intents (POST), history (GET), [contractId] (GET)
  - app/api/webhooks/stripe/route.ts: HMAC-verified, handles customer.subscription.created/updated/deleted, payment_intent.created/succeeded/payment_failed
- Subsystem 7 (Notifications): 439 total passing tests, docs/api/07-notifications.md, e2e/notifications.spec.ts
  - lib/supabase/notifications.ts: getNotifications (user client), markRead (admin client + userId filter), createNotification (admin client)
  - 3 API routes under app/api/notifications/: GET (list user's notifications), PATCH [id]/read (mark as read), POST (internal service-role create)
</completed_work>

<decisions_made>
- cancelSubscription uses subscriptions.update({cancel_at_period_end:true}) not .cancel() — schedules at period end, not immediate
- Stripe client is lazy-initialized — avoids test failures when STRIPE_SECRET_KEY is absent at import time
- getSubscriptionForUser(supabase, userId) joins brand_profiles — for routes; getSubscription(supabase, brandId) takes brand_profiles.id — for webhooks
- checkout client_reference_id = user.id; webhook reads metadata.brandProfileId for brand_profiles lookup
- payment_intent.created is a no-op when metadata.contractId absent (Stripe creates intents for subscriptions too)
- charges accessed via unknown cast — Stripe SDK v17 type definition differs from runtime shape
- adminSupabase used in: intents route (createPaymentRecord), cancel route (updateSubscription), all webhook writes
- pay_amount sourced server-side from getContractForPayment (contract→proposal join) — client cannot override
- markRead uses adminSupabase + explicit .eq('user_id', userId) — no UPDATE RLS policy on notification_logs (spec: "No UPDATE/DELETE from client"), so user client would PGRST116 silently
- POST /api/notifications protected with timingSafeEqual comparison of SUPABASE_SERVICE_ROLE_KEY bearer token
</decisions_made>

<remaining_work>
- Subsystem 8: Admin — lib/supabase/admin.ts + admin API routes + docs/api/08-admin.md
  - Tables: reports, audit_logs (already migrated with RLS)
  - RLS: reports SELECT = reporter reads own + admin reads all; INSERT = any authenticated user; UPDATE = admin only
  - audit_logs: SELECT = admin only; INSERT = service role only
</remaining_work>

<next_action>
Start Subsystem 8: Admin
- Spec: docs/superpowers/specs/2026-04-19-podium-backend-foundation-design.md (Section 08-admin)
- Tables: reports, audit_logs
- Pattern: follow lib/supabase/deals.ts and lib/supabase/payments.ts as template
- Admin routes likely under app/(admin)/ — check CLAUDE.md note about separate middleware
</next_action>
