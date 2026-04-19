# /new-feature

1. Invoke `superpowers:test-driven-development`
2. Read all files relevant to the feature before touching anything
3. Write failing Vitest unit tests for the core logic first
4. Implement the minimal code to make the tests pass
5. Write a Playwright E2E test covering the happy path user flow
6. Run `npm run lint` — fix all issues before continuing
7. Run `npm run type-check` — fix all issues before continuing
8. Invoke `superpowers:requesting-code-review`
9. Apply Bayesian confidence protocol — must reach ≥95% before committing
10. Commit with conventional commit message: `feat: <description>`
