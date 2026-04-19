# /deploy

1. Run `npm run check` — all three checks must pass before proceeding
2. Invoke `superpowers:finishing-a-development-branch`
3. Run `npm run e2e:chromium` — all E2E tests must pass
4. Push to the remote branch to trigger a Vercel preview deployment
5. Review the Vercel preview URL for visual regressions on key pages
6. Log the deploy in `docs/claude/confidence-log.md`
