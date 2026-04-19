# Podium Harness Setup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up the complete Podium development harness — Next.js 15 project, all tooling, CLAUDE.md, slash commands, Claude Code hooks, and memory docs — so all future feature work has guardrails, tests, and session continuity from day one.

**Architecture:** Next.js 15 App Router with TypeScript strict, Supabase for DB/Auth/Storage, Tailwind + shadcn/ui for UI, Vitest for unit tests, Playwright for E2E. Claude Code hooks enforce formatting and migration discipline after every file edit. Ralph Wiggum stop hook drives autonomous iteration loops.

**Tech Stack:** Next.js 15, TypeScript 5, Supabase JS v2, Tailwind CSS v4, shadcn/ui, Stripe, Vitest, Playwright, Prettier, ESLint

---

## File Map

**Created in this plan:**
- `package.json` — project dependencies and npm scripts
- `tsconfig.json` — TypeScript strict config
- `next.config.ts` — Next.js configuration
- `vitest.config.ts` — Vitest configuration
- `vitest.setup.ts` — Vitest global setup
- `playwright.config.ts` — Playwright E2E configuration
- `.env.local.example` — environment variable template
- `CLAUDE.md` — Claude operating rules (≤120 lines)
- `.claude/settings.json` — Claude Code hooks
- `.claude/commands/new-feature.md` — /new-feature workflow
- `.claude/commands/fix-bug.md` — /fix-bug workflow
- `.claude/commands/new-migration.md` — /new-migration workflow
- `.claude/commands/add-tests.md` — /add-tests workflow
- `.claude/commands/stripe-feature.md` — /stripe-feature workflow
- `.claude/commands/deploy.md` — /deploy workflow
- `.claude/commands/ralph.md` — /ralph workflow
- `docs/claude/architecture.md` — layer diagram and data flow
- `docs/claude/patterns.md` — concrete code patterns
- `docs/claude/lessons.md` — seeded with 5 starter rules
- `docs/claude/known-issues.md` — empty, ready for issues
- `docs/claude/testing.md` — testing strategy
- `docs/claude/confidence-log.md` — confidence gate log
- `middleware.ts` — auth + role route protection scaffold
- `lib/supabase/client.ts` — Supabase browser client helper
- `lib/supabase/server.ts` — Supabase server client helper
- `types/database.ts` — DB type stub (replaced by Supabase gen later)
- `supabase/migrations/.gitkeep` — migrations directory placeholder
- `e2e/.gitkeep` — E2E test directory placeholder

**Folder structure created (empty, with .gitkeep):**
- `app/(public)/`, `app/(athlete)/`, `app/(team)/`, `app/(brand)/`, `app/(agent)/`, `app/(admin)/`
- `app/api/webhooks/`, `app/api/cron/`, `app/api/upload/`
- `components/`, `lib/stripe/`, `lib/storage/`, `lib/realtime/`, `lib/notifications/`

---

## Task 1: Initialize Next.js 15 Project

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.ts`, `tailwind.config.ts`, `postcss.config.mjs`, `app/layout.tsx`, `app/page.tsx`

- [ ] **Step 1: Run create-next-app in the existing repo directory**

```bash
npx create-next-app@15 . \
  --typescript \
  --tailwind \
  --eslint \
  --app \
  --no-src-dir \
  --import-alias "@/*" \
  --yes
```

When prompted about existing files (the spec docs), confirm you want to continue. The tool will add Next.js files alongside the existing docs.

- [ ] **Step 2: Verify the dev server starts**

```bash
npm run dev
```

Expected: server starts on `http://localhost:3000` with no errors. Ctrl+C to stop.

- [ ] **Step 3: Commit the base project**

```bash
git add package.json tsconfig.json next.config.ts tailwind.config.ts \
  postcss.config.mjs app/ public/ .eslintrc.json .gitignore
git commit -m "feat: initialize Next.js 15 project"
```

---

## Task 2: Install All Dependencies

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install runtime dependencies**

```bash
npm install \
  @supabase/supabase-js@^2 \
  @supabase/ssr@^0 \
  stripe@^17 \
  @stripe/stripe-js@^5 \
  zustand@^5 \
  zod@^3 \
  date-fns@^4
```

- [ ] **Step 2: Install dev dependencies**

```bash
npm install --save-dev \
  vitest@^3 \
  @vitejs/plugin-react@^4 \
  @vitest/ui@^3 \
  jsdom@^26 \
  @testing-library/react@^16 \
  @testing-library/user-event@^14 \
  @testing-library/jest-dom@^6 \
  @playwright/test@^1 \
  @types/node@^22
```

- [ ] **Step 3: Install Playwright browsers**

```bash
npx playwright install chromium
```

Expected: downloads Chromium browser binary.

- [ ] **Step 4: Verify no peer dependency errors**

```bash
npm ls 2>&1 | grep -i "peer\|error" || echo "clean"
```

Expected: "clean" or no error lines.

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json
git commit -m "feat: add all project dependencies"
```

---

## Task 3: Configure shadcn/ui

**Files:**
- Create: `components.json`, `lib/utils.ts`
- Modify: `app/globals.css`, `tailwind.config.ts`

- [ ] **Step 1: Initialize shadcn/ui**

```bash
npx shadcn@latest init
```

When prompted:
- Style: **Default**
- Base color: **Slate**
- CSS variables: **Yes**

- [ ] **Step 2: Add core components used throughout the app**

```bash
npx shadcn@latest add button input label card badge avatar \
  dialog sheet dropdown-menu tabs toast form
```

- [ ] **Step 3: Verify components exist**

```bash
ls components/ui/
```

Expected: `button.tsx`, `input.tsx`, `card.tsx`, `badge.tsx`, `avatar.tsx`, `dialog.tsx`, `sheet.tsx`, `dropdown-menu.tsx`, `tabs.tsx`, `toast.tsx`, `form.tsx` (and others).

- [ ] **Step 4: Commit**

```bash
git add components/ components.json lib/utils.ts app/globals.css tailwind.config.ts
git commit -m "feat: configure shadcn/ui with core components"
```

---

## Task 4: Configure TypeScript Strict Mode

**Files:**
- Modify: `tsconfig.json`

- [ ] **Step 1: Replace tsconfig.json with strict config**

```json
{
  "compilerOptions": {
    "target": "ES2017",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true,
    "exactOptionalPropertyTypes": true,
    "noFallthroughCasesInSwitch": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [
      {
        "name": "next"
      }
    ],
    "paths": {
      "@/*": ["./*"]
    }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

- [ ] **Step 2: Verify type-check passes on fresh project**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add tsconfig.json
git commit -m "chore: enable TypeScript strict mode"
```

---

## Task 5: Configure Vitest

**Files:**
- Create: `vitest.config.ts`, `vitest.setup.ts`
- Modify: `package.json` (scripts added in Task 8)

- [ ] **Step 1: Create vitest.config.ts**

```typescript
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./vitest.setup.ts'],
    include: ['**/*.test.ts', '**/*.test.tsx'],
    exclude: ['node_modules', '.next', 'e2e'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      exclude: ['node_modules', '.next', 'e2e', '**/*.config.*', 'vitest.setup.ts'],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
})
```

- [ ] **Step 2: Create vitest.setup.ts**

```typescript
import '@testing-library/jest-dom'
```

- [ ] **Step 3: Write a smoke test to verify Vitest works**

Create `lib/utils.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { cn } from '@/lib/utils'

describe('cn utility', () => {
  it('merges class names', () => {
    expect(cn('foo', 'bar')).toBe('foo bar')
  })

  it('handles conditional classes', () => {
    expect(cn('foo', false && 'bar', 'baz')).toBe('foo baz')
  })
})
```

- [ ] **Step 4: Run the smoke test**

```bash
npx vitest run lib/utils.test.ts
```

Expected:
```
✓ lib/utils.test.ts (2)
  ✓ cn utility (2)
Test Files  1 passed
```

- [ ] **Step 5: Commit**

```bash
git add vitest.config.ts vitest.setup.ts lib/utils.test.ts
git commit -m "chore: configure Vitest with smoke test"
```

---

## Task 6: Configure Playwright

**Files:**
- Create: `playwright.config.ts`, `e2e/smoke.spec.ts`

- [ ] **Step 1: Create playwright.config.ts**

```typescript
import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1,
  reporter: [['html', { open: 'never' }]],
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: true,
    timeout: 120_000,
  },
})
```

- [ ] **Step 2: Create e2e/smoke.spec.ts**

```typescript
import { test, expect } from '@playwright/test'

test('homepage loads', async ({ page }) => {
  await page.goto('/')
  await expect(page).toHaveTitle(/podium/i)
})
```

- [ ] **Step 3: Update app/page.tsx to set a recognisable title**

```tsx
export default function Home() {
  return (
    <main>
      <h1>Podium</h1>
    </main>
  )
}
```

Update `app/layout.tsx` metadata:

```tsx
import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Podium — Sports Sponsorship Marketplace',
  description: 'The marketplace connecting athletes and teams with sponsors.',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={inter.className}>{children}</body>
    </html>
  )
}
```

- [ ] **Step 4: Run the smoke E2E test (dev server must be running)**

In one terminal:
```bash
npm run dev
```

In another terminal:
```bash
npx playwright test e2e/smoke.spec.ts --project=chromium
```

Expected:
```
Running 1 test using 1 worker
  ✓  e2e/smoke.spec.ts:3:1 › homepage loads
1 passed
```

- [ ] **Step 5: Commit**

```bash
git add playwright.config.ts e2e/smoke.spec.ts app/page.tsx app/layout.tsx
git commit -m "chore: configure Playwright with smoke E2E test"
```

---

## Task 7: Add npm Scripts

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Replace the scripts section in package.json**

Open `package.json` and replace the `"scripts"` section with:

```json
"scripts": {
  "dev": "next dev",
  "build": "next build",
  "start": "next start",
  "lint": "next lint",
  "type-check": "tsc --noEmit",
  "test": "vitest run",
  "test:watch": "vitest",
  "test:ui": "vitest --ui",
  "test:coverage": "vitest run --coverage",
  "e2e": "playwright test",
  "e2e:ui": "playwright test --ui",
  "e2e:chromium": "playwright test --project=chromium",
  "check": "npm run type-check && npm run lint && npm run test",
  "supabase:types": "supabase gen types typescript --local > types/database.ts"
}
```

- [ ] **Step 2: Verify the full check passes**

```bash
npm run check
```

Expected: type-check clean, lint clean, all tests pass.

- [ ] **Step 3: Commit**

```bash
git add package.json
git commit -m "chore: add npm scripts for type-check, test, e2e, and full check"
```

---

## Task 8: Initialize Supabase and Create Folder Structure

**Files:**
- Create: `supabase/config.toml` (via supabase init)
- Create: multiple directory scaffolds
- Create: `.env.local.example`

- [ ] **Step 1: Install Supabase CLI (if not already installed)**

```bash
npm install --save-dev supabase
```

- [ ] **Step 2: Initialize Supabase project**

```bash
npx supabase init
```

Expected: creates `supabase/config.toml` and `supabase/` directory structure.

- [ ] **Step 3: Create all folder scaffolds with .gitkeep**

```bash
mkdir -p \
  app/\(public\) \
  app/\(athlete\) \
  app/\(team\) \
  app/\(brand\) \
  app/\(agent\) \
  app/\(admin\) \
  app/api/webhooks \
  app/api/cron \
  app/api/upload \
  components/ui \
  lib/supabase \
  lib/stripe \
  lib/storage \
  lib/realtime \
  lib/notifications \
  types \
  e2e \
  supabase/migrations \
  docs/claude

touch \
  app/\(athlete\)/.gitkeep \
  app/\(team\)/.gitkeep \
  app/\(brand\)/.gitkeep \
  app/\(agent\)/.gitkeep \
  app/\(admin\)/.gitkeep \
  app/api/webhooks/.gitkeep \
  app/api/cron/.gitkeep \
  app/api/upload/.gitkeep \
  lib/stripe/.gitkeep \
  lib/storage/.gitkeep \
  lib/realtime/.gitkeep \
  lib/notifications/.gitkeep \
  supabase/migrations/.gitkeep
```

- [ ] **Step 4: Create .env.local.example**

```bash
cat > .env.local.example << 'EOF'
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Stripe
STRIPE_SECRET_KEY=sk_test_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000

# E-Signature (DocuSign or HelloSign — add when integrating)
# DOCUSIGN_INTEGRATION_KEY=
# DOCUSIGN_WEBHOOK_SECRET=
EOF
```

- [ ] **Step 5: Add .env.local to .gitignore (verify it's there)**

```bash
grep ".env.local" .gitignore || echo ".env.local" >> .gitignore
```

- [ ] **Step 6: Commit**

```bash
git add supabase/ app/ lib/ types/ e2e/ docs/ .env.local.example .gitignore
git commit -m "chore: scaffold folder structure and Supabase init"
```

---

## Task 9: Write Supabase Client Helpers

**Files:**
- Create: `lib/supabase/client.ts`
- Create: `lib/supabase/server.ts`
- Create: `types/database.ts`

- [ ] **Step 1: Create types/database.ts stub**

This file will be replaced by `npm run supabase:types` once the schema is defined. For now:

```typescript
export type Database = {
  public: {
    Tables: Record<string, never>
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: Record<string, never>
  }
}
```

- [ ] **Step 2: Create lib/supabase/client.ts (browser client)**

```typescript
import { createBrowserClient } from '@supabase/ssr'
import type { Database } from '@/types/database'

export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
```

- [ ] **Step 3: Create lib/supabase/server.ts (server client)**

```typescript
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import type { Database } from '@/types/database'

export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // setAll called from Server Component — safe to ignore
          }
        },
      },
    }
  )
}
```

- [ ] **Step 4: Write unit test for client helper**

Create `lib/supabase/client.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@supabase/ssr', () => ({
  createBrowserClient: vi.fn(() => ({ auth: {}, from: vi.fn() })),
}))

describe('createClient', () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co'
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key'
  })

  it('returns a Supabase client', async () => {
    const { createClient } = await import('./client')
    const client = createClient()
    expect(client).toBeDefined()
    expect(client).toHaveProperty('auth')
  })
})
```

- [ ] **Step 5: Run the test**

```bash
npx vitest run lib/supabase/client.test.ts
```

Expected: 1 test passes.

- [ ] **Step 6: Commit**

```bash
git add lib/supabase/ types/database.ts
git commit -m "feat: add Supabase client helpers (browser + server)"
```

---

## Task 10: Write middleware.ts

**Files:**
- Create: `middleware.ts`

- [ ] **Step 1: Create middleware.ts**

```typescript
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

const PUBLIC_PATHS = ['/', '/auth', '/auth/callback', '/auth/confirm']
const ADMIN_PATHS = ['/admin']

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  const pathname = request.nextUrl.pathname
  const isPublic = PUBLIC_PATHS.some((p) => pathname.startsWith(p))
  const isAdmin = ADMIN_PATHS.some((p) => pathname.startsWith(p))

  if (!user && !isPublic) {
    const url = request.nextUrl.clone()
    url.pathname = '/auth'
    return NextResponse.redirect(url)
  }

  if (isAdmin && !user) {
    const url = request.nextUrl.clone()
    url.pathname = '/auth'
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
```

- [ ] **Step 2: Verify type-check passes**

```bash
npm run type-check
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add middleware.ts
git commit -m "feat: add auth middleware with role-based route protection scaffold"
```

---

## Task 11: Write CLAUDE.md

**Files:**
- Create: `CLAUDE.md`

- [ ] **Step 1: Create CLAUDE.md**

```markdown
# CLAUDE.md — Podium

## Stack
Next.js 15 (App Router) · TypeScript strict · Supabase JS 2.x · Tailwind 4 · shadcn/ui · Stripe · Vitest · Playwright
All commands via `npm run` — see `package.json` scripts

## Task Routing (applied automatically — no explicit command needed)
| User says... | Apply |
|---|---|
| New feature / page / flow | `/new-feature` |
| Bug / wrong behaviour | `/fix-bug` |
| Schema change / new table / RLS | `/new-migration` |
| Missing tests | `/add-tests` |
| Stripe / payment work | `/stripe-feature` |
| Ready to deploy | `/deploy` |
| Autonomous loop needed | `/ralph` |

When intent is ambiguous: state which command you are applying and why before starting.

## Architecture Rules
- No Supabase calls outside `lib/supabase/` — never in components or route handlers directly
- No Stripe calls outside `lib/stripe/`
- Server Components fetch data; `"use client"` only for interactivity, never for data access
- Webhook handlers must verify HMAC signatures before any processing
- Large file uploads → generate presigned URL in `app/api/upload/` only — never stream through Next.js
- Every new DB table → write RLS policy before any code queries it
- Every schema change → migration file in `supabase/migrations/` first, then code
- `app/(admin)/` has separate middleware — never share auth logic with main app

## Layer Map
```
components/          → pure UI, no lib imports, no data fetching
lib/supabase/        → all DB queries (server + client helpers)
lib/stripe/          → all subscription and payment logic
lib/storage/         → presigned URL helpers only
lib/realtime/        → Supabase Realtime channel helpers
lib/notifications/   → email + push dispatch
app/api/webhooks/    → HMAC-verified event handlers
app/api/cron/        → background job handlers (Vercel Cron)
app/api/upload/      → presigned URL generation
middleware.ts        → auth + role-based route protection
```

## Supabase Rules
- Schema change → migration file → `supabase db push` → then code. Never dashboard-only.
- RLS required on every new table — no exceptions
- Store DateTime as UTC ISO 8601 string
- Service role key: Server Components and route handlers only — never in `"use client"` files

## TypeScript
- Strict mode — no `any`. `as Type` requires a comment explaining why.
- DB types come from `types/database.ts` (Supabase-generated) — never inline
- All shared types in `types/` — component-specific types co-located with the component

## Testing
- Unit/integration: Vitest — test file co-located with source (`lib/supabase/profiles.test.ts`)
- E2E: Playwright in `e2e/` — one spec file per major user flow
- Before done: `npm run test` passing + `npm run type-check` clean + `npm run lint` clean
- Full check: `npm run check`

## Bayesian Protocol
State prior → gather evidence → state posterior → gate at ≥95% → log in `docs/claude/confidence-log.md`
- P ≥ 95%: proceed and mark complete
- P 70–94%: identify the specific gap, fix it, re-estimate
- P < 70%: stop and ask

## Session Protocol
1. **Start**: check `docs/claude/handoff.md` → if it exists, invoke `gsd:resume-work` before anything else
2. **Limit**: at 60% context usage → invoke `gsd:pause-work` → writes handoff state → close session

## Superpowers
| Trigger | Skill |
|---|---|
| Ambiguous or open-ended request | `superpowers:brainstorming` |
| New feature or significant code change | `superpowers:test-driven-development` |
| Bug or unexpected failure | `superpowers:systematic-debugging` |
| Multi-step task needing a plan | `superpowers:writing-plans` |
| Executing agreed plan | `superpowers:executing-plans` |
| Before commit to main | `superpowers:requesting-code-review` |
| Before merge | `superpowers:finishing-a-development-branch` |
| Parallel independent work | `superpowers:dispatching-parallel-agents` |

## Slash Commands
`/new-feature` `/fix-bug` `/new-migration` `/add-tests` `/stripe-feature` `/deploy` `/ralph`
Full workflows in `.claude/commands/`

## CLAUDE.md Maintenance
Rule violated twice → rewrite it or move it to `docs/claude/lessons.md`
Rule already followed without being stated → delete it
```

- [ ] **Step 2: Verify line count is ≤120**

```bash
wc -l CLAUDE.md
```

Expected: ≤120 lines.

- [ ] **Step 3: Commit**

```bash
git add CLAUDE.md
git commit -m "feat: add CLAUDE.md — Claude operating rules for Podium"
```

---

## Task 12: Write Slash Commands

**Files:**
- Create: `.claude/commands/new-feature.md`
- Create: `.claude/commands/fix-bug.md`
- Create: `.claude/commands/new-migration.md`
- Create: `.claude/commands/add-tests.md`
- Create: `.claude/commands/stripe-feature.md`
- Create: `.claude/commands/deploy.md`
- Create: `.claude/commands/ralph.md`

- [ ] **Step 1: Create the commands directory**

```bash
mkdir -p .claude/commands
```

- [ ] **Step 2: Create .claude/commands/new-feature.md**

```markdown
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
```

- [ ] **Step 3: Create .claude/commands/fix-bug.md**

```markdown
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
```

- [ ] **Step 4: Create .claude/commands/new-migration.md**

```markdown
# /new-migration

1. Read ALL existing files in `supabase/migrations/` — never assume current schema state
2. Read `docs/claude/architecture.md` for the current data model
3. Write the migration SQL
4. Create the migration file with a timestamp prefix:
   `supabase/migrations/YYYYMMDDHHMMSS_description.sql`
5. Write the corresponding RLS policy in the same file or a companion policy file
6. Run `supabase db push` to apply to local Supabase instance
7. Run `npm run supabase:types` to regenerate `types/database.ts`
8. Update `docs/claude/architecture.md` if the schema change affects the documented data model
9. Apply Bayesian confidence protocol (≥95%)
10. Commit the migration file BEFORE committing any code that depends on it:
    `feat(db): add <description> migration`
```

- [ ] **Step 5: Create .claude/commands/add-tests.md**

```markdown
# /add-tests

1. Read the target file completely — understand every function and branch
2. List all untested paths: functions without tests, edge cases, error states, null inputs
3. Write Vitest unit tests for all logic in `lib/` — co-locate the test file
4. Write a Playwright E2E test if any path involves a visible user flow
5. Run `npm run test` — all must pass with no skipped tests
6. Run `npm run test:coverage` — review coverage report for remaining gaps
7. Apply Bayesian confidence protocol (≥95%)
8. Commit: `test: add tests for <file/feature>`
```

- [ ] **Step 6: Create .claude/commands/stripe-feature.md**

```markdown
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
```

- [ ] **Step 7: Create .claude/commands/deploy.md**

```markdown
# /deploy

1. Run `npm run check` — all three checks must pass before proceeding
2. Invoke `superpowers:finishing-a-development-branch`
3. Run `npm run e2e:chromium` — all E2E tests must pass
4. Push to the remote branch to trigger a Vercel preview deployment
5. Review the Vercel preview URL for visual regressions on key pages
6. Log the deploy in `docs/claude/confidence-log.md`
```

- [ ] **Step 8: Create .claude/commands/ralph.md**

```markdown
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
```

- [ ] **Step 9: Verify all 7 command files exist**

```bash
ls .claude/commands/
```

Expected: `new-feature.md`, `fix-bug.md`, `new-migration.md`, `add-tests.md`, `stripe-feature.md`, `deploy.md`, `ralph.md`

- [ ] **Step 10: Commit**

```bash
git add .claude/commands/
git commit -m "feat: add slash command workflows"
```

---

## Task 13: Configure Claude Code Hooks

**Files:**
- Create: `.claude/settings.json`

- [ ] **Step 1: Create .claude/settings.json**

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Write|Edit",
        "hooks": [
          {
            "type": "command",
            "command": "bash -c 'f=\"$CLAUDE_FILE_PATH\"; ext=\"${f##*.}\"; if [[ \"$ext\" == \"ts\" || \"$ext\" == \"tsx\" || \"$ext\" == \"js\" || \"$ext\" == \"jsx\" || \"$ext\" == \"json\" || \"$ext\" == \"css\" || \"$ext\" == \"md\" ]]; then npx prettier --write \"$f\" 2>/dev/null && echo \"[hook] formatted: $f\"; fi'"
          },
          {
            "type": "command",
            "command": "bash -c 'f=\"$CLAUDE_FILE_PATH\"; ext=\"${f##*.}\"; if [[ \"$ext\" == \"ts\" || \"$ext\" == \"tsx\" ]]; then result=$(npx next lint --file \"$f\" 2>&1); if echo \"$result\" | grep -q \"Error\\|error\"; then echo \"$result\" >&2; echo \"[hook] lint errors in $f — fix before continuing\" >&2; fi; fi'"
          }
        ]
      }
    ],
    "PreToolUse": [
      {
        "matcher": "Write|Edit",
        "hooks": [
          {
            "type": "command",
            "command": "bash -c 'f=\"$CLAUDE_FILE_PATH\"; b=$(basename \"$f\"); if [[ \"$b\" == \".env\" || \"$b\" == \".env.local\" ]]; then echo \"Never edit .env directly — use .env.local.example as a template and set values in .env.local\" >&2; exit 2; fi'"
          },
          {
            "type": "command",
            "command": "bash -c 'f=\"$CLAUDE_FILE_PATH\"; if [[ \"$f\" == *\"lib/supabase\"* || \"$f\" == *\"types/database\"* ]]; then today=$(date +%Y%m%d); if ! ls supabase/migrations/ 2>/dev/null | grep -q \"$today\"; then echo \"[hook] Editing DB layer — if this involves a schema change, run /new-migration first\"; fi; fi'"
          },
          {
            "type": "command",
            "command": "bash -c 'f=\"$CLAUDE_FILE_PATH\"; if [[ \"$f\" != *\".test.\"* && \"$f\" != *\".spec.\"* && (\"$f\" == *\".ts\" || \"$f\" == *\".tsx\") ]]; then testf=\"${f%.ts}.test.ts\"; testfx=\"${f%.tsx}.test.tsx\"; if [[ ! -f \"$testf\" && ! -f \"$testfx\" ]]; then echo \"[hook] No test file found for $f — remember to create one\"; fi; fi'"
          },
          {
            "type": "command",
            "command": "bash -c 'f=\"$CLAUDE_FILE_PATH\"; if [[ \"$f\" == *\"api/webhooks\"* ]]; then if [[ -f \"$f\" ]] && ! grep -qiE \"hmac|constructEvent|verifySignature|webhook.*secret\" \"$f\" 2>/dev/null; then echo \"[hook] WARNING: Webhook handler may be missing HMAC signature verification\" >&2; fi; fi'"
          }
        ]
      }
    ],
    "Stop": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "bash -c 'result=$(npm run test 2>&1 && npm run type-check 2>&1 && npm run lint 2>&1 && npx playwright test --project=chromium 2>&1); if echo \"$result\" | grep -qiE \"error|failed|FAIL\"; then echo \"STOP_HOOK_FAIL: not all checks pass — iterate\" >&2; exit 1; else echo \"TASK_COMPLETE\"; fi'"
          }
        ]
      }
    ]
  }
}
```

- [ ] **Step 2: Verify the settings file is valid JSON**

```bash
node -e "JSON.parse(require('fs').readFileSync('.claude/settings.json', 'utf8')); console.log('valid JSON')"
```

Expected: `valid JSON`

- [ ] **Step 3: Commit**

```bash
git add .claude/settings.json
git commit -m "feat: configure Claude Code hooks (format, lint, migration guard, test reminder)"
```

---

## Task 14: Write Memory Docs

**Files:**
- Create: `docs/claude/architecture.md`
- Create: `docs/claude/patterns.md`
- Create: `docs/claude/lessons.md`
- Create: `docs/claude/known-issues.md`
- Create: `docs/claude/testing.md`
- Create: `docs/claude/confidence-log.md`

- [ ] **Step 1: Create docs/claude/architecture.md**

```markdown
# Architecture — Podium

## Layer Diagram
```
Browser
  └── Next.js App Router (app/)
        ├── Server Components → lib/supabase/ → Supabase (Postgres)
        ├── Client Components → Supabase Realtime (websocket)
        ├── Route Handlers (app/api/)
        │     ├── /webhooks/stripe   → lib/stripe/ → Stripe API
        │     ├── /webhooks/esign    → e-signature provider API
        │     ├── /cron/*            → background cleanup jobs
        │     └── /upload            → Supabase Storage presigned URLs
        └── middleware.ts → Supabase Auth session validation
```

## Route Groups
| Group | Purpose | Auth |
|---|---|---|
| `(public)` | Landing, auth pages | None |
| `(athlete)` | Athlete dashboard, profile, discovery | Required — role: athlete |
| `(team)` | Team dashboard, profile, discovery | Required — role: team |
| `(brand)` | Brand dashboard, listings, search | Required — role: brand + active subscription |
| `(agent)` | Agent dashboard, client management | Required — role: agent |
| `(admin)` | Admin panel | Required — admin role + 2FA |

## Data Flow: Profile Fetch
1. Server Component calls `createClient()` from `lib/supabase/server.ts`
2. Query in `lib/supabase/profiles.ts`
3. Result typed via `types/database.ts` (generated)
4. Passed as props to Client Components — no client-side fetch for initial data

## Data Flow: File Upload (large media)
1. Client requests presigned URL from `app/api/upload/route.ts`
2. Server generates URL via Supabase Storage client (service role)
3. Client uploads directly to Supabase Storage — never through Next.js
4. Client sends the storage path to the DB mutation endpoint

## Background Jobs (Vercel Cron)
| Route | Schedule | Purpose |
|---|---|---|
| `/api/cron/gdpr-purge` | Daily 02:00 UTC | Delete accounts past 14-day grace period |
| `/api/cron/chat-clear` | Daily 03:00 UTC | Auto-clear chats per user retention setting |
| `/api/cron/guardian-expiry` | Daily 04:00 UTC | Purge partial under-18 profiles after 30 days |
| `/api/cron/subscription-grace` | Every 4h | Pause brand accounts after 72hr payment failure |
| `/api/cron/u18-birthday` | Daily 01:00 UTC | Transfer full control on athlete's 18th birthday |

## Required Environment Variables
See `.env.local.example` for full list.
Critical: `SUPABASE_SERVICE_ROLE_KEY` — server-only, never exposed to client.
```

- [ ] **Step 2: Create docs/claude/patterns.md**

```markdown
# Patterns — Podium

## Server Component Data Fetch
```typescript
// app/(athlete)/dashboard/page.tsx
import { createClient } from '@/lib/supabase/server'
import { getAthleteProfile } from '@/lib/supabase/profiles'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth')

  const profile = await getAthleteProfile(supabase, user.id)
  return <Dashboard profile={profile} />
}
```

## Supabase Query Pattern
```typescript
// lib/supabase/profiles.ts
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

export async function getAthleteProfile(
  supabase: SupabaseClient<Database>,
  userId: string
) {
  const { data, error } = await supabase
    .from('athlete_profiles')
    .select('*')
    .eq('user_id', userId)
    .single()

  if (error) throw new Error(`getAthleteProfile: ${error.message}`)
  return data
}
```

## Realtime Subscription (Client Component)
```typescript
// components/messaging/chat-messages.tsx
'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export function ChatMessages({ connectionId }: { connectionId: string }) {
  const [messages, setMessages] = useState<Message[]>([])
  const supabase = createClient()

  useEffect(() => {
    const channel = supabase
      .channel(`messages:${connectionId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `connection_id=eq.${connectionId}`,
      }, (payload) => {
        setMessages((prev) => [...prev, payload.new as Message])
      })
      .subscribe()

    return () => { void supabase.removeChannel(channel) }
  }, [connectionId, supabase])

  return <ul>{messages.map((m) => <li key={m.id}>{m.content}</li>)}</ul>
}
```

## Stripe Webhook Handler Pattern
```typescript
// app/api/webhooks/stripe/route.ts
import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)

export async function POST(request: NextRequest) {
  const body = await request.text()
  const sig = request.headers.get('stripe-signature')!

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET!)
  } catch {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  // handle event.type here
  return NextResponse.json({ received: true })
}
```

## Migration File Pattern
```sql
-- supabase/migrations/20260419120000_create_athlete_profiles.sql
create table public.athlete_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  created_at timestamptz not null default now()
);

-- RLS
alter table public.athlete_profiles enable row level security;

create policy "Athletes can view their own profile"
  on public.athlete_profiles for select
  using (auth.uid() = user_id);

create policy "Athletes can update their own profile"
  on public.athlete_profiles for update
  using (auth.uid() = user_id);
```
```

- [ ] **Step 3: Create docs/claude/lessons.md**

```markdown
# Lessons — Podium

- **Always verify webhook HMAC before processing any event**: Skipping this means fraudulent Stripe or DocuSign events get processed as real. Use `stripe.webhooks.constructEvent()` — return 400 if it throws.

- **Never expose SUPABASE_SERVICE_ROLE_KEY to client components**: This key bypasses RLS and has full DB access. It belongs only in Server Components, Route Handlers, and Cron jobs — never in any file with `"use client"`.

- **All under-18 athlete flows require a guardian check before any deal action**: Missing this is a legal liability. Check `athlete_profiles.guardian_id` is set and `guardian_profiles.consent_given = true` before allowing proposal acceptance or contract signing.

- **RLS policy must exist before any code queries a new table**: A table without RLS exposes all rows to all authenticated users. Write the policy in the same migration file as the table creation — not as a follow-up.

- **Presigned URLs expire — generate at request time, never cache**: Supabase Storage presigned URLs have a short TTL. Always generate fresh in `app/api/upload/route.ts` per request. Never store a presigned URL in the DB or localStorage.
```

- [ ] **Step 4: Create docs/claude/known-issues.md**

```markdown
# Known Issues — Podium

_No issues logged yet. Add entries here when TODOs, FIXMEs, or known tech debt are discovered._

## Format
```
## [YYYY-MM-DD] Short title
**File:** `path/to/file.ts:line`
**Issue:** What the problem is.
**Impact:** Who is affected and how.
**Fix:** What needs to be done (or "deferred to post-MVP").
```
```

- [ ] **Step 5: Create docs/claude/testing.md**

```markdown
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
```

- [ ] **Step 6: Create docs/claude/confidence-log.md**

```markdown
# Confidence Log — Podium

Format: `[YYYY-MM-DD] [component] [P%] [what most influenced the estimate]`

---

<!-- Entries added here as work progresses -->
```

- [ ] **Step 7: Commit all memory docs**

```bash
git add docs/claude/
git commit -m "feat: add Claude memory docs (architecture, patterns, lessons, testing)"
```

---

## Task 15: Final Verification

- [ ] **Step 1: Run the full check suite**

```bash
npm run check
```

Expected: type-check clean, lint clean, all Vitest tests pass.

- [ ] **Step 2: Run the E2E smoke test**

```bash
npm run e2e:chromium
```

Expected: `1 passed` — homepage loads test passes.

- [ ] **Step 3: Verify folder structure is correct**

```bash
ls app/ lib/ .claude/commands/ docs/claude/ supabase/migrations/
```

Expected: all directories exist.

- [ ] **Step 4: Verify CLAUDE.md line count**

```bash
wc -l CLAUDE.md
```

Expected: ≤120 lines.

- [ ] **Step 5: Log harness completion in confidence log**

Append to `docs/claude/confidence-log.md`:

```
[2026-04-19] [harness-setup] [98%] [all checks pass, hooks verified as valid JSON, E2E smoke passes — minor uncertainty on hook env var availability in all Claude Code versions]
```

- [ ] **Step 6: Final commit**

```bash
git add -A
git commit -m "feat: complete Podium development harness setup"
```

---

## Post-Setup: Local Environment Bootstrap

After the harness is built, run these once to get your local dev environment ready:

```bash
# 1. Copy and fill in environment variables
cp .env.local.example .env.local
# Edit .env.local with your Supabase project URL, anon key, and Stripe test keys

# 2. Start local Supabase
npx supabase start
# Note the local URL and anon key printed — use these in .env.local for local dev

# 3. Verify everything works
npm run dev         # should start on http://localhost:3000
npm run check       # should all pass
npm run e2e:chromium  # should pass
```
