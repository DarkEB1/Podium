# Testing Strategy — Podium

## Unit / Integration Tests (Vitest)

**What to test:** All functions in `lib/` — DB queries, Stripe logic, storage helpers, notification dispatch, business rules (under-18 checks, RLS-adjacent logic).

**File location:** Co-located with source.
- `lib/supabase/profiles.ts` → `lib/supabase/profiles.test.ts`
- `lib/stripe/subscriptions.ts` → `lib/stripe/subscriptions.test.ts`

**How to mock Supabase:**
```typescript
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() => ({
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: mockProfile, error: null }),
    })),
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: mockUser }, error: null }) },
  })),
}))
```

**How to run:**
```bash
npm run test           # all unit tests once
npm run test:watch     # watch mode during development
npm run test:coverage  # coverage report
```

## E2E Tests (Playwright)

**What to test:** Every major user flow end-to-end.
- Auth: sign-up → verify email → role select
- Athlete: profile creation → publish → appear in marketplace
- Brand: sign-up → subscription → search → connection request
- Deal flow: connection → proposal → counter → accept → e-sign → payment
- Admin: login with 2FA → view user → suspend account

**File location:** `e2e/` — one file per flow.
- `e2e/auth.spec.ts`
- `e2e/athlete-profile.spec.ts`
- `e2e/brand-search.spec.ts`
- `e2e/deal-flow.spec.ts`
- `e2e/admin.spec.ts`

**Local test environment:**
```bash
# Terminal 1 — local Supabase
npx supabase start

# Terminal 2 — Stripe local listener
stripe listen --forward-to localhost:3000/api/webhooks/stripe

# Terminal 3 — Next.js dev server (Playwright starts this automatically)
npm run dev

# Terminal 4 — run E2E
npm run e2e:chromium
```

**Coverage target:** Every flow listed in the spec has at least one E2E happy-path test before shipping.
