# /stripe-feature

1. Invoke `superpowers:test-driven-development`
2. Read all files in `lib/stripe/` before touching anything
3. Write failing Vitest tests covering: success path, failure path, idempotency
4. Implement the feature in `lib/stripe/` — no Stripe calls anywhere else
5. If implementing a webhook handler in `app/api/webhooks/`:
   - Verify Stripe webhook signature using `stripe.webhooks.constructEvent()`
   - Use idempotency keys on all Stripe API write calls
   - Test both valid and invalid signature scenarios
6. Write a Playwright E2E test covering the payment user flow using Stripe test mode
7. Test subscription upgrade, downgrade, and cancellation paths if affected
8. Run `npm run check` — all checks must pass
9. Apply Bayesian confidence protocol (≥95%)
10. Commit: `feat(stripe): <description>`
