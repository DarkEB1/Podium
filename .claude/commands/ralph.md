# /ralph

Enter an autonomous Ralph Wiggum iteration loop.

**Stop condition** — ALL of the following must exit 0:
```bash
npm run test && npm run type-check && npm run lint && npx playwright test --project=chromium
```

**Limits:**
- Feature work: maximum 20 iterations
- Bug fixes: maximum 15 iterations

**On reaching the limit without passing:**
1. Write a BLOCKED report to `docs/claude/handoff.md` with:
   - Current state of the task
   - Which check is still failing and the exact error
   - What was tried and why it didn't work
   - Recommended next step for a human
2. Stop. Do not continue iterating.

**Output `TASK_COMPLETE` when all checks pass.**
