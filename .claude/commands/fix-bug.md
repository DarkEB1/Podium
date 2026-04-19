# /fix-bug

1. Invoke `superpowers:systematic-debugging`
2. Read all files related to the bug before changing anything
3. Identify the root cause — do not fix symptoms
4. Write a failing test that reproduces the bug exactly
5. Implement the fix until the test passes
6. Run `npm run test` — verify no regressions across the full suite
7. Run `npm run type-check` and `npm run lint` — fix all issues
8. Apply Bayesian confidence protocol (≥95%)
9. Append a lesson to `docs/claude/lessons.md`: what caused the bug and why this rule prevents recurrence
10. Commit: `fix: <description>`
