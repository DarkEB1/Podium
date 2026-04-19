# /add-tests

1. Read the target file completely — understand every function and branch
2. List all untested paths: functions without tests, edge cases, error states, null inputs
3. Write Vitest unit tests for all logic in `lib/` — co-locate the test file
4. Write a Playwright E2E test if any path involves a visible user flow
5. Run `npm run test` — all must pass with no skipped tests
6. Run `npm run test:coverage` — review coverage report for remaining gaps
7. Apply Bayesian confidence protocol (≥95%)
8. Commit: `test: add tests for <file/feature>`
