---
plan: docs/superpowers/plans/2026-04-19-podium-backend-foundation.md
task: 0 of 20
status: ready_to_execute
last_updated: 2026-04-19T16:41:38Z
head_sha: c728e47
---

<current_state>
Foundation plan is written and committed. Ready to execute Task 1 of 20. No code written yet — only spec + plan documents exist. Start a fresh session and execute the plan.
</current_state>

<completed_work>

- Brainstorming: decomposed backend into 8 subsystems, chose sequential approach
- Design spec: docs/superpowers/specs/2026-04-19-podium-backend-foundation-design.md (approved, committed)
- Implementation plan: docs/superpowers/plans/2026-04-19-podium-backend-foundation.md (20 tasks, 37 tests, committed)
- Self-review: fixed import-order bug in Task 12 (imports must be at top of auth.ts, not appended mid-file)
</completed_work>

<remaining_work>

All 20 implementation tasks are pending:
- Tasks 1–9: Write 8 migration SQL files (19 tables, all enums, all RLS)
- Task 10: Apply migrations + regenerate types/database.ts
- Tasks 11–12: lib/supabase/auth.ts (TDD)
- Tasks 13–18: 8 auth API routes in app/api/auth/ (TDD)
- Task 19: docs/api/01-auth.md
- Task 20: Full check + handoff update
</remaining_work>

<decisions_made>

- Backend scope: DB + RLS + lib/ + API routes only (no UI)
- Supabase: local CLI only (npx supabase start)
- Schema: all 17 spec tables + notification_logs + blocks = 19 tables in 8 domain-grouped migration files
- API style: REST API routes (not Server Actions) for clean frontend-agnostic contract
- Migration naming: 20260419000001_users_auth.sql through 20260419000008_admin.sql
- Enums: all 24 defined in migration 01, referenced across all other migrations
- Role lock: enforced at DB level via RLS WITH CHECK, not just application logic
- Mandatory proposal mechanic: enforced via matches.proposal_required + messages INSERT RLS
- Enumeration protection: signup + password-reset always return identical success messages
- Admin role: not selectable via /api/auth/role — created out-of-band only
</decisions_made>

<blockers>
None.
</blockers>

<context>
This is Subsystem 1 of 8 of the Podium backend. The 8 subsystems are:
1. Foundation (this plan) — schema + auth
2. Profiles — athlete/team/brand/agent CRUD
3. Discovery — connections, matches, search
4. Messaging — real-time chat
5. Deals — proposals + contracts + e-signature
6. Payments — Stripe subscriptions + deal payments
7. Notifications — push/email/in-app
8. Admin — separate admin panel

Each subsystem follows the same pattern: lib/supabase/<domain>.ts + app/api/<domain>/ routes + docs/api/0N-<domain>.md.

The spec is at docs/superpowers/specs/2026-04-19-podium-backend-foundation-design.md.
The plan is at docs/superpowers/plans/2026-04-19-podium-backend-foundation.md.
</context>

<next_action>
/clear then execute the plan: open docs/superpowers/plans/2026-04-19-podium-backend-foundation.md and start at Task 1. Use superpowers:executing-plans or superpowers:subagent-driven-development skill.
</next_action>
