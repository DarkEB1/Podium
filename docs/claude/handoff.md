---
plan: docs/superpowers/plans/2026-04-21-athlete-dashboard.md
task: Phase 2 — Task 1 of 12 (not started)
status: ready_to_execute
last_updated: 2026-04-21T13:37:57.477Z
head_sha: 2104ffc
---

<current_state>
Phase 2 (Athlete Dashboard) plan is written and ready to execute. No tasks have been implemented yet. The detailed plan lives at docs/superpowers/plans/2026-04-21-athlete-dashboard.md. User chose subagent-driven-development (option 1) for execution. Session paused due to context limits before first task was dispatched.
</current_state>

<completed_work>

- Phase 1: Public & Auth Shell ✅ (all 11 tasks, 511 tests passing)
- Phase 2 plan written ✅ — docs/superpowers/plans/2026-04-21-athlete-dashboard.md
  - 12 tasks, all files mapped, all code written in plan, no placeholders
</completed_work>

<remaining_work>

Phase 2 tasks (all pending):
- Task 1: App shell — theme toggle
- Task 2: App shell — notification bell + tests
- Task 3: App shell — nav shell + athlete layout
- Task 4: Athlete onboarding routes + wizard skeleton (step 1–6)
- Task 5: Guardian form + profile preview + publish endpoint
- Task 6: Athlete dashboard page
- Task 7: Discovery — listing card + listings grid + discover page
- Task 8: Saved page + connection request card + requests page
- Task 9: Messages — match list + messages index page
- Task 10: Chat — bubble + proposal card + chat window + chat page
- Task 11: Settings page
- Task 12: Final check + handoff update
</remaining_work>

<decisions_made>

- Working on main branch (no worktrees) — user preference
- No Button asChild — Button uses @base-ui/react, not Radix. Use `<Link className={buttonVariants(...)}>`. In CLAUDE.md.
- Backend is complete — do not modify lib/supabase/, lib/stripe/, app/api/ (exception: app/api/profiles/me/publish/route.ts is a new endpoint needed by wizard step 6)
- Execution approach: subagent-driven-development (fresh subagent per task + two-stage review)
- requests page uses direct Supabase query (no lib wrapper exists) — documented as tech debt
- Photo upload deferred to future phase (requires presigned URL flow)
</decisions_made>

<blockers>
None.
</blockers>

<context>
The Phase 2 plan is self-contained with full code for every step. The implementer subagent should read the plan file and execute task by task. Key constraints for every task:
1. No `<Button asChild>` — use `<Link className={buttonVariants({ variant, size })}>` from `@/components/ui/button`
2. Server components fetch data; "use client" only for forms/interactive UI
3. No Supabase calls in client components — API routes only
4. Types from types/database.ts — never inline
5. All tests must pass before committing

The plan at docs/superpowers/plans/2026-04-21-athlete-dashboard.md has the complete implementation with exact file paths, full code, and test code for each task.
</context>

<next_action>
Fresh session: invoke `gsd:resume-work`, then begin executing the plan at docs/superpowers/plans/2026-04-21-athlete-dashboard.md using superpowers:subagent-driven-development. Start with Task 1 (theme toggle).
</next_action>
