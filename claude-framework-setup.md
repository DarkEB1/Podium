# Claude Development Framework Setup

You are being tasked with designing and implementing a bespoke autonomous development harness for this Flutter project. Your work is complete only when every item in the Deliverables Checklist is done and the confidence gate has been passed for each one.


## Confidence Protocol (read this first — it applies to every step below)

Before marking any task, file, or component complete:

1. **Gather data** — What did you just build or change? Run `flutter analyze` and `flutter test` (if tests exist). Does the output match the stated goal exactly?

2. **Bayesian estimate** — Given the evidence, what is P(this is correct and won't break anything)?
   - State the percentage explicitly
   - List the 2–3 factors most affecting your estimate (e.g. missing test coverage, untested platform differences, Supabase RLS implications)
   - Common uncertainty sources for this stack: Riverpod provider lifecycle edge cases, Supabase auth state on cold start, iOS vs Android rendering differences, missing null safety guards

3. **Gate**
   - P ≥ 95% → proceed, mark complete
   - P < 95% → stop. Identify the specific gap. Fix it. Re-estimate. Repeat until ≥ 95%.

4. **Log** — Append one line to `docs/claude/confidence-log.md`:
   `[YYYY-MM-DD] [component] [P%] [what most influenced the estimate]`

This is non-negotiable. Do not skip it, do not batch it at the end.

---

## Phase 1: Codebase Archaeology

Read the project thoroughly before building anything. You are looking for:

- Overall architecture and layer boundaries (where does UI live, where does business logic live, where do Supabase calls live)
- How Riverpod is actually used: which provider types, how state is structured, naming conventions
- How Supabase is called: query patterns, auth flow, error handling approach
- How Firebase Crashlytics is integrated
- All dependencies in pubspec.yaml and their versions
- Any existing CLAUDE.md, docs/, or .claude/ directories — read everything there
- Existing tests (if any) — how many, what kind, what patterns
- Existing CI/CD config (if any)
- Git log: what kinds of changes are most frequent, where bugs have been fixed
- Any TODO, FIXME, or HACK comments in the codebase
- The iOS and Android folder structure — bundle IDs, package names, signing config

Do not build anything yet. Compile your findings into a mental model. Every artifact you create must reflect what is actually in this codebase, not generic Flutter advice.

Apply the confidence protocol before proceeding to Phase 2.

---

## Phase 2: External Tools Research & Evaluation

Research and evaluate each tool below for fit with this specific project (Flutter/Dart, Riverpod, Supabase, Firebase Crashlytics, iOS + Android, solo developer, GitHub). For each, give an **adopt / skip / defer** verdict with a one-line rationale.

**MCP Servers:**
- Context7 (`mcp__context7`) — real-time Flutter, Riverpod, Supabase library docs so you never use outdated APIs
- GitHub MCP — Claude autonomously creates PRs, reads issues, manages branches
- Playwright MCP — E2E and integration test automation

**Deployment Automation:**
- Fastlane — iOS/Android automated signing, TestFlight uploads, Play Store deployment, build number incrementing

**Code Quality:**
- Danger (Ruby gem) — automated review comments on PRs, enforces conventions
- Codecov — test coverage thresholds in CI, coverage badges
- very_good_cli — VGV Flutter project standards and analysis config

**Versioning:**
- semantic-release — automated changelog generation and version bumping from commit messages

**Loop Automation:**
- Ralph Wiggum (`/ralph-loop`) — Stop hook autonomous iteration until tests pass (already in use for this setup)

**Already installed globally — assess whether and how to wire into this project:**
- `superpowers:test-driven-development` — structured TDD workflow
- `superpowers:systematic-debugging` — root-cause-first debugging discipline
- `superpowers:requesting-code-review` — subagent code review before commit
- `superpowers:finishing-a-development-branch` — pre-merge checklist
- `superpowers:using-git-worktrees` — parallel feature work in isolation
- `gsd:pause-work` / `gsd:resume-work` — session continuity on context limit
- `gsd:quick` — lightweight task execution without full GSD overhead
- `taches-cc-resources:debug-like-expert` — deep debugging for hard problems
- `taches-cc-resources:create-hooks` — hook authoring guidance

Write your evaluation to `docs/claude/tools-evaluation.md` with a clear adopt/skip/defer table and brief rationale for each. Apply confidence protocol before continuing.

---

## Phase 3: Build the Framework

Build each component in order. Apply the confidence protocol before marking each one complete.

### 3.1 CLAUDE.md

Write a CLAUDE.md (replace existing if minimal) that is the single source of truth for how Claude operates in this project. Maximum 100 lines — every line must prevent a real mistake. Include:

- **Stack**: Flutter version, Dart version, Riverpod version, Supabase client version, Freezed version (read from pubspec.yaml)
- **Architecture rules**: derived from what you found in Phase 1 — which layers exist, what belongs where, what must never cross boundaries
- **Dart/Riverpod standards**: derived from actual patterns in this codebase — provider types used, naming conventions, async patterns, how state is structured; no generic advice
- **Supabase rules**: every schema change requires a migration file; RLS must be considered for every new table; always handle auth errors explicitly
- **Error handling**: the actual pattern this codebase uses (derive from code)
- **Testing requirement**: every new provider, repository method, and widget with logic gets a test — no exceptions
- **Before marking any task done**: run `flutter analyze` (zero issues), run `flutter test` (all passing), apply confidence protocol
- **Session start**: read `docs/claude/architecture.md`, `docs/claude/patterns.md`, `docs/claude/known-issues.md`, `docs/claude/lessons.md` before writing any code
- **Session continuity**: when context usage exceeds 60%, invoke `gsd:pause-work` to save handoff state; at session start check for a handoff doc and invoke `gsd:resume-work`
- **Slash commands available**: list each command in `.claude/commands/` and what it does
- **On mistakes**: append a rule to `docs/claude/lessons.md` immediately when corrected — do not wait

### 3.2 Memory Documents

Populate each with real content from Phase 1. These are Claude's persistent memory — they must be accurate to this codebase.

**`docs/claude/architecture.md`**
Layer diagram (text), data flow from UI to Supabase and back, key architectural decisions made in this codebase, what lives where, dependency directions, anything that is non-obvious.

**`docs/claude/patterns.md`**
Concrete patterns with examples derived from the actual code:
- How Riverpod providers are structured and named
- How Supabase queries are written (query builder vs RPC vs raw SQL)
- How errors are caught, typed, and surfaced to UI
- How navigation works
- How widgets are structured and where state lives
- How Freezed classes are defined

**`docs/claude/known-issues.md`**
All TODOs, FIXMEs, HACKs, and obvious tech debt found in the codebase. Honest assessment — this prevents Claude from working around problems that should be fixed.

**`docs/claude/lessons.md`**
Start with 5 lessons derived from inconsistencies or code smells found in Phase 1 (e.g. if error handling is inconsistent in places, write a rule about it). Format: `- [lesson]: [why it matters in this codebase]`

**`docs/claude/testing.md`**
Testing strategy specific to this codebase:
- What test types are needed and when (unit, widget, integration)
- How to mock Supabase and Riverpod dependencies
- Test file naming and location conventions
- How to test async Riverpod providers
- Coverage target

**`docs/claude/tools-evaluation.md`**
Already written in Phase 2.

**`docs/claude/confidence-log.md`**
Create empty file with header. Will be populated as work progresses.

### 3.3 Claude Code Hooks

Configure `.claude/settings.json` with the following hooks. Use `taches-cc-resources:create-hooks` for guidance on correct hook syntax if needed.

**PostToolUse — after any Write or Edit tool call:**
- Run `dart format` on the modified file
- Run `flutter analyze` — if it returns warnings or errors, output them to stderr so Claude sees them and must fix before continuing

**PreToolUse — before any Write or Edit tool call:**
- Block edits to any `.env` file with exit code 2 and message: "Never edit .env directly. Use environment config pattern."
- If the file being edited touches Supabase schema or migration-related code: check that a corresponding file exists in the migrations directory. If not, block with: "Schema change detected — create a migration file first."
- If the file being edited is a non-test Dart file: check whether a corresponding `_test.dart` file exists. If not, remind Claude (exit 0 with message, do not block): "No test file found for this file. Remember to create one."

**Stop hook (Ralph Wiggum — only if adopted in Phase 2):**
- Install the ralph-wiggum plugin
- Default acceptance criteria: `flutter test` passes AND `flutter analyze` returns zero issues
- Embed completion promise in prompts: output `FRAMEWORK_COMPLETE` when done
- Max iterations: 20 for feature work, 15 for bug fixes

### 3.4 GitHub Actions Pipeline

Create `.github/workflows/ci.yml`. Base the configuration on what you found in Phase 1 (existing config, Flutter version, test setup). The pipeline must:

**On every push and PR:**
1. `quality-gate` job: `dart format --output=none --set-exit-if-changed` then `flutter analyze --no-fatal-infos`; fail fast
2. `test` job: `flutter test --coverage`; upload coverage report (to Codecov if adopted)
3. `migration-check` job: if any Supabase-related file changed, verify a corresponding migration file exists with a matching timestamp or reference

**On every push to main only:**
4. `build-android` job (ubuntu runner): `flutter build apk --release` with pub cache and Flutter SDK cached
5. `build-ios` job (macos runner): `flutter build ios --no-codesign`

**On manual trigger (workflow_dispatch) only:**
6. `deploy-android-beta`: invoke Fastlane android beta lane
7. `deploy-ios-beta`: invoke Fastlane ios beta lane

Store all signing credentials, API keys, and store credentials as GitHub Actions secrets. Document which secrets are needed in `docs/claude/architecture.md`.

### 3.5 Fastlane

Create `fastlane/Appfile` using bundle identifier and package name read from the iOS and Android project files.

Create `fastlane/Fastfile` with these lanes:

- **`ios beta`**: increment build number from git commit count, build IPA with release config, upload to TestFlight via App Store Connect API
- **`android beta`**: increment version code, build AAB, deploy to Firebase App Distribution
- **`ios release`**: build + submit to App Store for review (manual trigger only, requires version bump)
- **`android release`**: build AAB + submit to Google Play internal track (manual trigger only)

If Fastlane was not adopted in Phase 2, document why and propose a simpler alternative using GitHub Actions directly.

### 3.6 Slash Commands

Create these files in `.claude/commands/`. Each command must be a concise workflow — no fluff, no optional steps.

**`new-feature.md`**
1. Invoke `superpowers:test-driven-development`
2. Read relevant existing files before touching anything
3. Write failing tests first
4. Implement until tests pass
5. Run `flutter analyze` — fix any issues
6. Invoke `superpowers:requesting-code-review`
7. Apply confidence protocol (must reach ≥95% before committing)
8. Commit with conventional commit message

**`fix-bug.md`**
1. Invoke `superpowers:systematic-debugging`
2. Identify root cause — do not fix symptoms
3. Write a failing test that reproduces the bug
4. Fix until test passes
5. Run full test suite — confirm no regressions
6. Run `flutter analyze`
7. Apply confidence protocol
8. Append lesson to `docs/claude/lessons.md` if the bug reveals a pattern worth remembering
9. Commit

**`new-migration.md`**
1. Read current schema from existing migration files (do not assume — read the files)
2. Write migration SQL
3. Create migration file with timestamp prefix in the correct migrations directory
4. Update `docs/claude/architecture.md` if the schema change affects documented data flow
5. Apply confidence protocol
6. Commit migration file before any code that depends on it

**`add-tests.md`**
1. Read the target file completely
2. Identify all untested code paths (providers, repository methods, edge cases, error states)
3. Write tests — unit for logic, widget for UI behaviour
4. Run `flutter test` — all must pass
5. Apply confidence protocol
6. Commit

**`deploy-beta.md`**
1. Confirm all tests pass locally: `flutter test`
2. Confirm no analysis issues: `flutter analyze`
3. Invoke `superpowers:finishing-a-development-branch`
4. Trigger Fastlane beta lanes (or GitHub Actions workflow_dispatch if Fastlane not adopted)
5. Log deploy in `docs/claude/known-issues.md` if any known issue was shipped

### 3.7 Superpowers Skill Wiring

The following skills are already installed. Add explicit invocation instructions to CLAUDE.md so they are used structurally, not optionally:

- `superpowers:test-driven-development` — invoke at the start of every new feature or bug fix
- `superpowers:systematic-debugging` — invoke whenever a test fails unexpectedly or a bug is reported
- `superpowers:requesting-code-review` — invoke before every commit to main
- `superpowers:finishing-a-development-branch` — invoke before every merge
- `gsd:pause-work` — invoke when context usage exceeds 60%
- `gsd:resume-work` — invoke at session start if a handoff doc exists

### 3.8 Session Continuity

Add to CLAUDE.md (this prevents losing work when context resets):
- At the start of every session: check for `docs/claude/handoff.md`. If it exists, run `gsd:resume-work` before anything else.
- During work: track active tasks using the TaskCreate/TaskUpdate tools
- When context approaches 60% full: run `gsd:pause-work`, which writes current state to `docs/claude/handoff.md`
- Never abandon an in-progress task without writing the current state to the handoff doc

---

## Deliverables Checklist

Mark each complete only after the confidence protocol has been applied and logged. The loop does not exit until every item is checked.

- [ ] `CLAUDE.md` — ≤100 lines, bespoke to this codebase, no generic advice
- [ ] `docs/claude/architecture.md` — accurate layer diagram and data flow
- [ ] `docs/claude/patterns.md` — concrete patterns with examples from actual code
- [ ] `docs/claude/known-issues.md` — all TODOs/FIXMEs catalogued
- [ ] `docs/claude/lessons.md` — ≥5 entries derived from Phase 1 findings
- [ ] `docs/claude/testing.md` — concrete testing strategy for this stack
- [ ] `docs/claude/tools-evaluation.md` — adopt/skip/defer for every tool listed
- [ ] `docs/claude/confidence-log.md` — entry for every completed component
- [ ] `.claude/settings.json` — PostToolUse, PreToolUse, and Stop hooks configured
- [ ] `.github/workflows/ci.yml` — all jobs defined and syntactically valid
- [ ] `fastlane/Fastfile` + `fastlane/Appfile` — all four lanes defined (or documented alternative)
- [ ] `.claude/commands/new-feature.md`
- [ ] `.claude/commands/fix-bug.md`
- [ ] `.claude/commands/new-migration.md`
- [ ] `.claude/commands/add-tests.md`
- [ ] `.claude/commands/deploy-beta.md`
- [ ] Superpowers skill invocations documented in CLAUDE.md
- [ ] Session continuity protocol documented in CLAUDE.md
- [ ] Ralph Wiggum configured (if adopted) or documented why not
- [ ] `flutter analyze` returns zero issues on all new/modified files
- [ ] All confidence log entries show P ≥ 95%

TODO BEFORE I PROMPT - RALPH WIGGUM (search up and add), Bayesian thinking on every change, make claude edit this framework.
