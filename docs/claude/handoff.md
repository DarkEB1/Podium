---
plan: docs/superpowers/plans/2026-04-19-podium-harness-setup.md
task: 4 of 15
status: in_progress
last_updated: 2026-04-19T14:42:12Z
head_sha: 3fbd2fe
---

<current_state>
Executing the Podium harness setup plan using superpowers:subagent-driven-development. Tasks 1–3 are complete and committed. Currently at Task 4 (TypeScript strict config). Working directly on `main` branch in `C:/Users/nicho/Documents/Podium/Podium`.
</current_state>

<completed_work>

- Task 1: Initialize Next.js 15 — DONE (commit ebaa841, merged with docs at 021a4a3)
- Task 2: Install all dependencies — DONE (Supabase, Stripe, Zustand, Zod, date-fns, Vitest, Playwright, Testing Library; @vitest/coverage-v8 added as fix)
- Task 3: Configure shadcn/ui — DONE (base-nova style, 12 components; form.tsx guard bug fixed; base-nova lesson added to docs/claude/lessons.md)

HEAD is at 3fbd2fe.
</completed_work>

<remaining_work>

- Task 4: Configure TypeScript strict mode (replace tsconfig.json with strict config)
- Task 5: Configure Vitest (vitest.config.ts + vitest.setup.ts + smoke test)
- Task 6: Configure Playwright (playwright.config.ts + e2e/smoke.spec.ts)
- Task 7: Add npm scripts (test, type-check, e2e, check, supabase:types etc.)
- Task 8: Initialize Supabase + create folder structure (supabase init, all route group dirs, .env.local.example)
- Task 9: Write Supabase client helpers (lib/supabase/client.ts, server.ts, types/database.ts)
- Task 10: Write middleware.ts (auth + role-based route protection scaffold)
- Task 11: Write CLAUDE.md (≤120 lines, full content in plan)
- Task 12: Write slash commands (7 files in .claude/commands/)
- Task 13: Configure Claude Code hooks (.claude/settings.json with PostToolUse, PreToolUse, Stop)
- Task 14: Write memory docs (6 files in docs/claude/)
- Task 15: Final verification (npm run check + e2e smoke + commit)
</remaining_work>

<decisions_made>

- Working directly on main branch (no worktrees) — user explicitly authorized
- shadcn v4 base-nova style accepted over plan's default/slate — newer, RSC-compatible, @base-ui/react primitives
- sonner replaces toast (shadcn v4 breaking change) — documented in lessons.md
- @vitest/coverage-v8 added as fix (was omitted from plan's Task 2) — needed for npm run test:coverage
- docs/claude/lessons.md already exists with 2 entries (base-nova note added during Task 3 fix)
</decisions_made>

<blockers>
None currently. All three completed tasks passed spec compliance and code quality review.
</blockers>

<context>
Using superpowers:subagent-driven-development skill. Each task gets:
1. Implementer subagent (haiku for mechanical tasks, sonnet for judgment tasks)
2. Spec compliance reviewer subagent (haiku)
3. Code quality reviewer subagent (superpowers:code-reviewer)

The plan file has full task text with exact code to write — subagents should be given the full task text verbatim. Do NOT make subagents read the plan file themselves; paste the task text into the prompt.

Important context for remaining tasks:
- docs/claude/lessons.md already exists (created during Task 3 fix) — when Task 14 writes it, check first and APPEND/MERGE rather than overwrite
- The project uses Tailwind v4 CSS-first (no tailwind.config.ts) — the plan mentions tailwind.config.ts in some steps but the actual project does not have one. shadcn uses CSS variables in globals.css instead.
- package.json name is "podium" (lowercase) — create-next-app naming restriction workaround
</context>

<next_action>
Resume with: invoke `superpowers:subagent-driven-development` skill, then dispatch implementer subagent for Task 4 (TypeScript strict mode). Full task text is in `docs/superpowers/plans/2026-04-19-podium-harness-setup.md` under "## Task 4: Configure TypeScript Strict Mode".

Mark task #8 (Task 3 group) as completed first, then task #9 (Tasks 4-8) as in_progress.
</next_action>
