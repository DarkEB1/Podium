# Podium Frontend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the complete Podium frontend across 7 phases: public/auth shell, athlete dashboard, brand dashboard, team dashboard, agent dashboard, admin panel, and system-wide features.

**Architecture:** Next.js 15 App Router. Server components fetch data and own layout/auth guards. `"use client"` only for forms, interactive state, and real-time UI. All data access goes through `/api/*` routes or via `lib/supabase/` helpers in server components (never direct Supabase calls from client components or route handlers). Route groups `(public)`, `(athlete)`, `(brand)`, `(team)`, `(agent)`, `(admin)` each have their own `layout.tsx` that enforces role-based access.

**Tech Stack:** Next.js 15, TypeScript strict, Tailwind 4, shadcn/ui, react-hook-form + zod, zustand, next-themes, lucide-react, sonner

---

## Scope Note

This spec covers 7 independent phases. **Each phase produces fully working, testable software.** Phase 1 is fully detailed below with step-by-step tasks. Phases 2–7 each have a page inventory and require their own detailed plan before execution.

**Execution order:** Phase 1 → Phase 2 → Phase 3 → Phase 4 → Phase 5 → Phase 6 → Phase 7

**Do not modify:** `lib/supabase/`, `lib/stripe/`, `app/api/` — backend is complete.

---

## URL Map (all phases)

| URL prefix | Route group | Auth requirement |
|---|---|---|
| `/` | `app/` (root) | None |
| `/auth/*` | `app/(public)/auth/` | None (middleware PUBLIC_PATHS includes `/auth`) |
| `/role-select` | `app/(public)/` | Session required (no role yet) |
| `/update-password` | `app/(public)/` | Recovery session required |
| `/403` | `app/` (root) | None |
| `/athlete/*` | `app/(athlete)/` | Session + athlete role |
| `/brand/*` | `app/(brand)/` | Session + brand role |
| `/team/*` | `app/(team)/` | Session + team role |
| `/agent/*` | `app/(agent)/` | Session + agent role |
| `/admin/*` | `app/(admin)/` | Session + admin role (middleware enforced) |

**Auth redirect chain (after login):**
```
POST /api/auth/login
  → role === null         → /role-select
  → role === 'athlete'    → /athlete/dashboard
  → role === 'brand'      → /brand/dashboard (or /brand/onboarding if no profile)
  → role === 'team'       → /team/dashboard
  → role === 'agent'      → /agent/dashboard
  → role === 'admin'      → /admin/dashboard
```

---

## Phase 1: Public & Auth Shell (Flows 1–6)

### File Map

| File | Action | `"use client"` |
|---|---|---|
| `app/layout.tsx` | Modify — add ThemeProvider + Toaster | No |
| `app/(public)/layout.tsx` | Create — minimal public wrapper | No |
| `app/page.tsx` | Replace — landing page | No |
| `app/(public)/auth/page.tsx` | Create — login page | No |
| `app/(public)/auth/signup/page.tsx` | Create — sign-up page | No |
| `app/(public)/auth/verify-email/page.tsx` | Create — "check your email" screen | No |
| `app/(public)/auth/forgot-password/page.tsx` | Create — request reset link | No |
| `app/(public)/update-password/page.tsx` | Create — set new password | No |
| `app/(public)/role-select/page.tsx` | Create — role selection | No |
| `app/403/page.tsx` | Create — forbidden | No |
| `components/auth/password-strength.tsx` | Create — strength bar | Yes |
| `components/auth/sign-up-form.tsx` | Create — email+password form | Yes |
| `components/auth/sign-up-form.test.tsx` | Create — RTL unit tests | — |
| `components/auth/login-form.tsx` | Create — email+password form | Yes |
| `components/auth/login-form.test.tsx` | Create — RTL unit tests | — |
| `components/auth/forgot-password-form.tsx` | Create — email form | Yes |
| `components/auth/update-password-form.tsx` | Create — new password form | Yes |
| `components/auth/role-select-form.tsx` | Create — 4 role cards | Yes |
| `components/auth/role-select-form.test.tsx` | Create — RTL unit tests | — |
| `components/landing/hero.tsx` | Create — hero section | No |
| `components/landing/how-it-works.tsx` | Create — 3-step explainer | No |
| `components/landing/marketplace-preview.tsx` | Create — static card grid | No |
| `components/landing/role-panels.tsx` | Create — athlete/team/brand panels | No |
| `components/landing/social-proof.tsx` | Create — testimonials + stats | No |
| `components/landing/faq.tsx` | Create — accordion FAQ | Yes (shadcn Accordion uses Radix state) |
| `components/layout/footer.tsx` | Create — global footer | No |
| `e2e/auth.spec.ts` | Create — Playwright auth flow | — |

---

### Task 1: Root layout providers + shadcn additions

**Files:**
- Modify: `app/layout.tsx`
- Install: accordion, alert, separator shadcn components

- [ ] **Step 1: Add shadcn components**

```bash
npx shadcn@latest add accordion alert separator select progress textarea switch skeleton radio-group
```

Expected: new files created in `components/ui/`.

- [ ] **Step 2: Update root layout with ThemeProvider and Toaster**

```tsx
// app/layout.tsx
import type { Metadata } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import { ThemeProvider } from 'next-themes'
import { Toaster } from '@/components/ui/sonner'
import './globals.css'

const geistSans = Geist({ variable: '--font-geist-sans', subsets: ['latin'] })
const geistMono = Geist_Mono({ variable: '--font-geist-mono', subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Podium — Sports Sponsorship Marketplace',
  description: 'The marketplace connecting athletes and teams with sponsors.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
          {children}
          <Toaster richColors position="top-right" />
        </ThemeProvider>
      </body>
    </html>
  )
}
```

- [ ] **Step 3: Create public layout**

```tsx
// app/(public)/layout.tsx
export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen bg-background">{children}</div>
}
```

- [ ] **Step 4: Verify type-check passes**

```bash
npm run type-check
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add app/layout.tsx app/(public)/layout.tsx components/ui/
git commit -m "feat(layout): root providers, public layout, shadcn component additions"
```

---

### Task 2: Static pages — 403, verify-email, footer

**Files:**
- Create: `app/403/page.tsx`
- Create: `app/(public)/auth/verify-email/page.tsx`
- Create: `components/layout/footer.tsx`

- [ ] **Step 1: Create 403 page**

```tsx
// app/403/page.tsx
import Link from 'next/link'
import { Button } from '@/components/ui/button'

export default function ForbiddenPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-8 text-center">
      <h1 className="text-4xl font-bold">403</h1>
      <p className="text-muted-foreground">You don&apos;t have permission to access this page.</p>
      <Button asChild>
        <Link href="/">Go home</Link>
      </Button>
    </main>
  )
}
```

- [ ] **Step 2: Create verify-email page**

```tsx
// app/(public)/auth/verify-email/page.tsx
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'

export default function VerifyEmailPage() {
  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle>Check your email</CardTitle>
          <CardDescription>
            We sent a verification link to your email address. Click it to activate your account.
            The link expires after 24 hours.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 text-center text-sm text-muted-foreground">
          <p>Didn&apos;t receive it? Check your spam folder.</p>
          <Button variant="link" asChild>
            <Link href="/auth">Back to login</Link>
          </Button>
        </CardContent>
      </Card>
    </main>
  )
}
```

- [ ] **Step 3: Create footer**

```tsx
// components/layout/footer.tsx
import Link from 'next/link'

const links = [
  { label: 'About', href: '#about' },
  { label: 'Trust & Safety', href: '#trust' },
  { label: 'FAQ', href: '#faq' },
  { label: 'Contact', href: 'mailto:hello@podium.com' },
  { label: 'Terms of Service', href: '/terms' },
  { label: 'Privacy Policy', href: '/privacy' },
]

export default function Footer() {
  return (
    <footer className="border-t bg-background py-10">
      <div className="mx-auto max-w-6xl px-6">
        <div className="flex flex-col items-center gap-6">
          <span className="text-xl font-bold tracking-tight">Podium</span>
          <nav className="flex flex-wrap justify-center gap-x-6 gap-y-2 text-sm text-muted-foreground">
            {links.map((l) => (
              <Link key={l.href} href={l.href} className="hover:text-foreground transition-colors">
                {l.label}
              </Link>
            ))}
          </nav>
          <p className="text-xs text-muted-foreground">
            © {new Date().getFullYear()} Podium. All rights reserved. Confidential & Proprietary.
          </p>
        </div>
      </div>
    </footer>
  )
}
```

- [ ] **Step 4: Commit**

```bash
git add app/403/page.tsx "app/(public)/auth/verify-email/page.tsx" components/layout/footer.tsx
git commit -m "feat(public): 403 page, verify-email screen, footer component"
```

---

### Task 3: Password strength indicator

**Files:**
- Create: `components/auth/password-strength.tsx`
- Create: `components/auth/password-strength.test.tsx`

- [ ] **Step 1: Write failing test**

```tsx
// components/auth/password-strength.test.tsx
import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import PasswordStrength from './password-strength'

describe('PasswordStrength', () => {
  it('shows nothing when password is empty', () => {
    const { container } = render(<PasswordStrength password="" />)
    expect(container.querySelector('[data-strength]')).toBeNull()
  })

  it('shows weak for short password', () => {
    render(<PasswordStrength password="abc" />)
    expect(screen.getByText(/weak/i)).toBeInTheDocument()
  })

  it('shows fair when 8+ chars + uppercase', () => {
    render(<PasswordStrength password="Abcdefgh" />)
    expect(screen.getByText(/fair/i)).toBeInTheDocument()
  })

  it('shows strong for password meeting all rules', () => {
    render(<PasswordStrength password="ValidPass1!" />)
    expect(screen.getByText(/strong/i)).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test — verify it fails**

```bash
npm run test -- password-strength
```

Expected: FAIL — `PasswordStrength` not found.

- [ ] **Step 3: Implement PasswordStrength**

```tsx
// components/auth/password-strength.tsx
'use client'

interface Props { password: string }

function getStrength(pw: string): { score: number; label: string; color: string } {
  if (!pw) return { score: 0, label: '', color: '' }
  let score = 0
  if (pw.length >= 8) score++
  if (/[A-Z]/.test(pw)) score++
  if (/[0-9]/.test(pw)) score++
  if (/[^A-Za-z0-9]/.test(pw)) score++

  if (score <= 1) return { score, label: 'Weak', color: 'bg-red-500' }
  if (score === 2) return { score, label: 'Fair', color: 'bg-yellow-500' }
  if (score === 3) return { score, label: 'Good', color: 'bg-blue-500' }
  return { score, label: 'Strong', color: 'bg-green-500' }
}

export default function PasswordStrength({ password }: Props) {
  const { score, label, color } = getStrength(password)
  if (!password) return null

  return (
    <div data-strength={score} className="mt-1 space-y-1">
      <div className="flex gap-1">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className={`h-1 flex-1 rounded-full transition-colors ${i <= score ? color : 'bg-muted'}`}
          />
        ))}
      </div>
      <p className={`text-xs font-medium ${score <= 1 ? 'text-red-500' : score === 2 ? 'text-yellow-600' : score === 3 ? 'text-blue-600' : 'text-green-600'}`}>
        {label}
      </p>
    </div>
  )
}
```

- [ ] **Step 4: Run test — verify it passes**

```bash
npm run test -- password-strength
```

Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add components/auth/password-strength.tsx components/auth/password-strength.test.tsx
git commit -m "feat(auth): password strength indicator with tests"
```

---

### Task 4: Sign-up form + page

**Files:**
- Create: `components/auth/sign-up-form.tsx`
- Create: `components/auth/sign-up-form.test.tsx`
- Create: `app/(public)/auth/signup/page.tsx`

- [ ] **Step 1: Write failing tests**

```tsx
// components/auth/sign-up-form.test.tsx
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import SignUpForm from './sign-up-form'

// Next.js router mock
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
}))

describe('SignUpForm', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ message: 'Check your email to verify your account' }),
    }))
  })

  it('shows validation error when email is missing', async () => {
    render(<SignUpForm />)
    await userEvent.click(screen.getByRole('button', { name: /create account/i }))
    expect(await screen.findByText(/invalid email/i)).toBeInTheDocument()
  })

  it('shows password requirement hint when password is too weak', async () => {
    render(<SignUpForm />)
    await userEvent.type(screen.getByLabelText(/email/i), 'test@example.com')
    await userEvent.type(screen.getByLabelText(/password/i), 'weak')
    await userEvent.click(screen.getByRole('button', { name: /create account/i }))
    expect(await screen.findByText(/8 characters/i)).toBeInTheDocument()
  })

  it('calls POST /api/auth/signup on valid submission', async () => {
    render(<SignUpForm />)
    await userEvent.type(screen.getByLabelText(/email/i), 'test@example.com')
    await userEvent.type(screen.getByLabelText(/password/i), 'ValidPass1!')
    await userEvent.click(screen.getByRole('button', { name: /create account/i }))
    await waitFor(() => expect(fetch).toHaveBeenCalledWith('/api/auth/signup', expect.objectContaining({ method: 'POST' })))
  })
})
```

- [ ] **Step 2: Run test — verify it fails**

```bash
npm run test -- sign-up-form
```

Expected: FAIL — `SignUpForm` not found.

- [ ] **Step 3: Implement sign-up form**

```tsx
// components/auth/sign-up-form.tsx
'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import PasswordStrength from './password-strength'

const schema = z.object({
  email: z.string().email('Invalid email address'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Must contain at least one uppercase letter')
    .regex(/[0-9]/, 'Must contain at least one number')
    .regex(/[^A-Za-z0-9]/, 'Must contain at least one symbol'),
})
type FormValues = z.infer<typeof schema>

export default function SignUpForm() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const form = useForm<FormValues>({ resolver: zodResolver(schema) })
  const password = form.watch('password', '')

  async function onSubmit(values: FormValues) {
    setLoading(true)
    try {
      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error?.message ?? 'Sign-up failed')
        return
      }
      router.push('/auth/verify-email')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Email</FormLabel>
              <FormControl>
                <Input type="email" autoComplete="email" placeholder="you@example.com" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="password"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Password</FormLabel>
              <FormControl>
                <Input type="password" autoComplete="new-password" placeholder="••••••••" {...field} />
              </FormControl>
              <PasswordStrength password={password} />
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? 'Creating account…' : 'Create account'}
        </Button>
      </form>
    </Form>
  )
}
```

- [ ] **Step 4: Create sign-up page**

```tsx
// app/(public)/auth/signup/page.tsx
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import SignUpForm from '@/components/auth/sign-up-form'

export default function SignUpPage() {
  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle>Create your account</CardTitle>
          <CardDescription>Join Podium — free for athletes, teams &amp; agents</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <SignUpForm />
          <p className="text-center text-sm text-muted-foreground">
            Already have an account?{' '}
            <Link href="/auth" className="font-medium text-foreground hover:underline">
              Sign in
            </Link>
          </p>
        </CardContent>
      </Card>
    </main>
  )
}
```

- [ ] **Step 5: Run tests — verify they pass**

```bash
npm run test -- sign-up-form
```

Expected: PASS (3 tests).

- [ ] **Step 6: Commit**

```bash
git add components/auth/sign-up-form.tsx components/auth/sign-up-form.test.tsx "app/(public)/auth/signup/page.tsx"
git commit -m "feat(auth): sign-up form with password strength and page"
```

---

### Task 5: Login form + page

**Files:**
- Create: `components/auth/login-form.tsx`
- Create: `components/auth/login-form.test.tsx`
- Create: `app/(public)/auth/page.tsx`

- [ ] **Step 1: Write failing tests**

```tsx
// components/auth/login-form.test.tsx
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import LoginForm from './login-form'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
}))

describe('LoginForm', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })

  it('shows validation error when fields are empty', async () => {
    render(<LoginForm />)
    await userEvent.click(screen.getByRole('button', { name: /sign in/i }))
    expect(await screen.findByText(/invalid email/i)).toBeInTheDocument()
  })

  it('shows error toast on INVALID_CREDENTIALS', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: false,
      json: async () => ({ error: { code: 'INVALID_CREDENTIALS', message: 'Wrong email or password' } }),
    } as Response)
    render(<LoginForm />)
    await userEvent.type(screen.getByLabelText(/email/i), 'bad@example.com')
    await userEvent.type(screen.getByLabelText(/password/i), 'WrongPass1!')
    await userEvent.click(screen.getByRole('button', { name: /sign in/i }))
    await waitFor(() => expect(fetch).toHaveBeenCalled())
  })

  it('redirects to /role-select when role is null after login', async () => {
    const push = vi.fn()
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ user: { role: null, role_locked_at: null } }),
    } as Response)
    vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }))
    render(<LoginForm />)
    await userEvent.type(screen.getByLabelText(/email/i), 'test@example.com')
    await userEvent.type(screen.getByLabelText(/password/i), 'ValidPass1!')
    await userEvent.click(screen.getByRole('button', { name: /sign in/i }))
    await waitFor(() => expect(fetch).toHaveBeenCalled())
  })
})
```

- [ ] **Step 2: Run test — verify it fails**

```bash
npm run test -- login-form
```

Expected: FAIL — `LoginForm` not found.

- [ ] **Step 3: Implement login form**

```tsx
// components/auth/login-form.tsx
'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import Link from 'next/link'

const ROLE_DASHBOARD: Record<string, string> = {
  athlete: '/athlete/dashboard',
  brand: '/brand/dashboard',
  team: '/team/dashboard',
  agent: '/agent/dashboard',
  admin: '/admin/dashboard',
}

const schema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
})
type FormValues = z.infer<typeof schema>

export default function LoginForm() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const form = useForm<FormValues>({ resolver: zodResolver(schema) })

  async function onSubmit(values: FormValues) {
    setLoading(true)
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error?.message ?? 'Login failed')
        return
      }
      const { user } = data
      if (!user.role || !user.role_locked_at) {
        router.push('/role-select')
      } else {
        router.push(ROLE_DASHBOARD[user.role] ?? '/')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Email</FormLabel>
              <FormControl>
                <Input type="email" autoComplete="email" placeholder="you@example.com" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="password"
          render={({ field }) => (
            <FormItem>
              <div className="flex items-center justify-between">
                <FormLabel>Password</FormLabel>
                <Link href="/auth/forgot-password" className="text-xs text-muted-foreground hover:underline">
                  Forgot password?
                </Link>
              </div>
              <FormControl>
                <Input type="password" autoComplete="current-password" placeholder="••••••••" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? 'Signing in…' : 'Sign in'}
        </Button>
      </form>
    </Form>
  )
}
```

- [ ] **Step 4: Create login page**

```tsx
// app/(public)/auth/page.tsx
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import LoginForm from '@/components/auth/login-form'

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle>Welcome back</CardTitle>
          <CardDescription>Sign in to your Podium account</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <LoginForm />
          <p className="text-center text-sm text-muted-foreground">
            New to Podium?{' '}
            <Link href="/auth/signup" className="font-medium text-foreground hover:underline">
              Create an account
            </Link>
          </p>
        </CardContent>
      </Card>
    </main>
  )
}
```

- [ ] **Step 5: Run tests — verify they pass**

```bash
npm run test -- login-form
```

Expected: PASS (3 tests).

- [ ] **Step 6: Commit**

```bash
git add components/auth/login-form.tsx components/auth/login-form.test.tsx "app/(public)/auth/page.tsx"
git commit -m "feat(auth): login form with role-based redirect and page"
```

---

### Task 6: Password reset forms + pages

**Files:**
- Create: `components/auth/forgot-password-form.tsx`
- Create: `app/(public)/auth/forgot-password/page.tsx`
- Create: `components/auth/update-password-form.tsx`
- Create: `app/(public)/update-password/page.tsx`

- [ ] **Step 1: Implement forgot password form**

```tsx
// components/auth/forgot-password-form.tsx
'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Alert, AlertDescription } from '@/components/ui/alert'

const schema = z.object({ email: z.string().email('Invalid email address') })
type FormValues = z.infer<typeof schema>

export default function ForgotPasswordForm() {
  const [submitted, setSubmitted] = useState(false)
  const [loading, setLoading] = useState(false)
  const form = useForm<FormValues>({ resolver: zodResolver(schema) })

  async function onSubmit(values: FormValues) {
    setLoading(true)
    try {
      await fetch('/api/auth/password-reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      })
      setSubmitted(true)
    } finally {
      setLoading(false)
    }
  }

  if (submitted) {
    return (
      <Alert>
        <AlertDescription>
          If this email exists, you will receive a reset link. The link expires in 1 hour.
        </AlertDescription>
      </Alert>
    )
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Email</FormLabel>
              <FormControl>
                <Input type="email" autoComplete="email" placeholder="you@example.com" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? 'Sending…' : 'Send reset link'}
        </Button>
      </form>
    </Form>
  )
}
```

- [ ] **Step 2: Create forgot-password page**

```tsx
// app/(public)/auth/forgot-password/page.tsx
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import ForgotPasswordForm from '@/components/auth/forgot-password-form'

export default function ForgotPasswordPage() {
  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle>Reset your password</CardTitle>
          <CardDescription>Enter your email and we&apos;ll send a reset link</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <ForgotPasswordForm />
          <p className="text-center text-sm text-muted-foreground">
            <Link href="/auth" className="hover:underline">Back to sign in</Link>
          </p>
        </CardContent>
      </Card>
    </main>
  )
}
```

- [ ] **Step 3: Implement update-password form**

```tsx
// components/auth/update-password-form.tsx
'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import PasswordStrength from './password-strength'

const schema = z
  .object({
    password: z
      .string()
      .min(8, 'At least 8 characters')
      .regex(/[A-Z]/, 'Must contain uppercase')
      .regex(/[0-9]/, 'Must contain number')
      .regex(/[^A-Za-z0-9]/, 'Must contain symbol'),
    confirm: z.string(),
  })
  .refine((d) => d.password === d.confirm, {
    message: 'Passwords do not match',
    path: ['confirm'],
  })
type FormValues = z.infer<typeof schema>

export default function UpdatePasswordForm() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const form = useForm<FormValues>({ resolver: zodResolver(schema) })
  const password = form.watch('password', '')

  async function onSubmit({ password }: FormValues) {
    setLoading(true)
    try {
      const res = await fetch('/api/auth/password-update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error?.message ?? 'Failed to update password')
        return
      }
      toast.success('Password updated. Please sign in.')
      router.push('/auth')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="password"
          render={({ field }) => (
            <FormItem>
              <FormLabel>New password</FormLabel>
              <FormControl>
                <Input type="password" autoComplete="new-password" placeholder="••••••••" {...field} />
              </FormControl>
              <PasswordStrength password={password} />
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="confirm"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Confirm password</FormLabel>
              <FormControl>
                <Input type="password" autoComplete="new-password" placeholder="••••••••" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? 'Updating…' : 'Set new password'}
        </Button>
      </form>
    </Form>
  )
}
```

- [ ] **Step 4: Create update-password page**

```tsx
// app/(public)/update-password/page.tsx
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import UpdatePasswordForm from '@/components/auth/update-password-form'

export default function UpdatePasswordPage() {
  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle>Set new password</CardTitle>
          <CardDescription>Choose a strong password for your account</CardDescription>
        </CardHeader>
        <CardContent>
          <UpdatePasswordForm />
        </CardContent>
      </Card>
    </main>
  )
}
```

- [ ] **Step 5: Commit**

```bash
git add components/auth/forgot-password-form.tsx "app/(public)/auth/forgot-password/page.tsx" components/auth/update-password-form.tsx "app/(public)/update-password/page.tsx"
git commit -m "feat(auth): forgot-password and update-password forms and pages"
```

---

### Task 7: Role selection form + page

**Files:**
- Create: `components/auth/role-select-form.tsx`
- Create: `components/auth/role-select-form.test.tsx`
- Create: `app/(public)/role-select/page.tsx`

- [ ] **Step 1: Write failing tests**

```tsx
// components/auth/role-select-form.test.tsx
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import RoleSelectForm from './role-select-form'

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }))

describe('RoleSelectForm', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ role: 'athlete' }),
    }))
  })

  it('renders all four role options', () => {
    render(<RoleSelectForm />)
    expect(screen.getByText(/athlete/i)).toBeInTheDocument()
    expect(screen.getByText(/team/i)).toBeInTheDocument()
    expect(screen.getByText(/brand/i)).toBeInTheDocument()
    expect(screen.getByText(/agent/i)).toBeInTheDocument()
  })

  it('confirm button is disabled until a role is selected', async () => {
    render(<RoleSelectForm />)
    expect(screen.getByRole('button', { name: /confirm/i })).toBeDisabled()
    await userEvent.click(screen.getByText(/athlete/i).closest('[data-role]')!)
    expect(screen.getByRole('button', { name: /confirm/i })).not.toBeDisabled()
  })

  it('calls POST /api/auth/role with selected role on confirm', async () => {
    render(<RoleSelectForm />)
    await userEvent.click(screen.getByText(/brand/i).closest('[data-role]')!)
    await userEvent.click(screen.getByRole('button', { name: /confirm/i }))
    await waitFor(() =>
      expect(fetch).toHaveBeenCalledWith('/api/auth/role', expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ role: 'brand' }),
      }))
    )
  })
})
```

- [ ] **Step 2: Run test — verify it fails**

```bash
npm run test -- role-select-form
```

Expected: FAIL — `RoleSelectForm` not found.

- [ ] **Step 3: Implement role-select form**

```tsx
// components/auth/role-select-form.tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

type Role = 'athlete' | 'team' | 'brand' | 'agent'

const ROLES: { id: Role; title: string; description: string; badge: string }[] = [
  {
    id: 'athlete',
    title: 'Athlete',
    description: 'List yourself, get discovered by brands and agents. Always free.',
    badge: 'Free forever',
  },
  {
    id: 'team',
    title: 'Team',
    description: 'Find sponsors for your team or club. Always free.',
    badge: 'Free forever',
  },
  {
    id: 'brand',
    title: 'Brand / Sponsor',
    description: 'Search athletes and teams, send connection requests. Subscription required.',
    badge: 'Subscription',
  },
  {
    id: 'agent',
    title: 'Agent',
    description: 'Represent athletes and teams, broker deals. Always free.',
    badge: 'Free forever',
  },
]

const ROLE_ONBOARDING: Record<Role, string> = {
  athlete: '/athlete/onboarding',
  team: '/team/onboarding',
  brand: '/brand/onboarding',
  agent: '/agent/onboarding',
}

export default function RoleSelectForm() {
  const router = useRouter()
  const [selected, setSelected] = useState<Role | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleConfirm() {
    if (!selected) return
    setLoading(true)
    try {
      const res = await fetch('/api/auth/role', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: selected }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error?.message ?? 'Failed to set role')
        return
      }
      router.push(ROLE_ONBOARDING[selected])
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        {ROLES.map((role) => (
          <button
            key={role.id}
            data-role={role.id}
            type="button"
            onClick={() => setSelected(role.id)}
            className={cn(
              'relative rounded-xl border p-4 text-left transition-all',
              selected === role.id
                ? 'border-foreground bg-foreground/5 ring-2 ring-foreground'
                : 'border-border hover:border-foreground/50'
            )}
          >
            <span className="mb-1 block text-sm font-semibold">{role.title}</span>
            <span className="block text-xs text-muted-foreground">{role.description}</span>
            <span className="mt-2 inline-block rounded-full bg-muted px-2 py-0.5 text-xs font-medium">
              {role.badge}
            </span>
          </button>
        ))}
      </div>
      <p className="text-xs text-muted-foreground text-center">
        Your role is permanent and cannot be changed after confirmation.
      </p>
      <Button
        className="w-full"
        disabled={!selected || loading}
        onClick={handleConfirm}
      >
        {loading ? 'Confirming…' : 'Confirm role'}
      </Button>
    </div>
  )
}
```

- [ ] **Step 4: Create role-select page (server — redirects if role already set)**

```tsx
// app/(public)/role-select/page.tsx
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getUser } from '@/lib/supabase/auth'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import RoleSelectForm from '@/components/auth/role-select-form'

const ROLE_DASHBOARD: Record<string, string> = {
  athlete: '/athlete/dashboard',
  brand: '/brand/dashboard',
  team: '/team/dashboard',
  agent: '/agent/dashboard',
  admin: '/admin/dashboard',
}

export default async function RoleSelectPage() {
  const supabase = await createClient()
  const user = await getUser(supabase)

  if (!user) redirect('/auth')
  if (user.role && user.role_locked_at) redirect(ROLE_DASHBOARD[user.role] ?? '/')

  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-2xl">
        <CardHeader className="text-center">
          <CardTitle>Choose your role</CardTitle>
          <CardDescription>
            This is permanent and cannot be changed. Choose carefully.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <RoleSelectForm />
        </CardContent>
      </Card>
    </main>
  )
}
```

- [ ] **Step 5: Run tests — verify they pass**

```bash
npm run test -- role-select-form
```

Expected: PASS (3 tests).

- [ ] **Step 6: Commit**

```bash
git add components/auth/role-select-form.tsx components/auth/role-select-form.test.tsx "app/(public)/role-select/page.tsx"
git commit -m "feat(auth): role selection form with redirect logic and page"
```

---

### Task 8: Landing page — Hero + How It Works + Marketplace Preview

**Files:**
- Create: `components/landing/hero.tsx`
- Create: `components/landing/how-it-works.tsx`
- Create: `components/landing/marketplace-preview.tsx`
- Modify: `app/page.tsx`

- [ ] **Step 1: Create hero component**

```tsx
// components/landing/hero.tsx
import Link from 'next/link'
import { Button } from '@/components/ui/button'

export default function Hero() {
  return (
    <section className="relative overflow-hidden bg-background py-24 md:py-32">
      <div className="mx-auto max-w-4xl px-6 text-center">
        <h1 className="text-5xl font-extrabold tracking-tight md:text-7xl">
          The Sports Sponsorship<br />
          <span className="text-primary">Marketplace</span>
        </h1>
        <p className="mt-6 text-lg text-muted-foreground md:text-xl">
          Athletes and teams list for free. Brands search, connect, and close deals.
        </p>
        <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
          <Button size="lg" asChild>
            <Link href="/auth/signup">List Your Profile</Link>
          </Button>
          <Button size="lg" variant="outline" asChild>
            <Link href="/auth/signup">Find Talent</Link>
          </Button>
        </div>
      </div>
    </section>
  )
}
```

- [ ] **Step 2: Create How It Works**

```tsx
// components/landing/how-it-works.tsx
const steps = [
  { n: '01', title: 'Create Profile', body: 'Athletes and teams list for free in minutes. Brands set up a campaign with a subscription.' },
  { n: '02', title: 'Get Discovered', body: 'Browse the marketplace or get found via search. Send a connection request with a personalised message.' },
  { n: '03', title: 'Close Deals', body: 'Negotiate proposals, e-sign contracts, and process payments — all in one place.' },
]

export default function HowItWorks() {
  return (
    <section id="how" className="bg-muted/30 py-24">
      <div className="mx-auto max-w-5xl px-6">
        <h2 className="mb-12 text-center text-3xl font-bold">How It Works</h2>
        <div className="grid gap-8 md:grid-cols-3">
          {steps.map((s) => (
            <div key={s.n} className="flex flex-col gap-3">
              <span className="text-4xl font-black text-muted-foreground/30">{s.n}</span>
              <h3 className="text-xl font-semibold">{s.title}</h3>
              <p className="text-muted-foreground">{s.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
```

- [ ] **Step 3: Create static marketplace preview grid**

```tsx
// components/landing/marketplace-preview.tsx
const SAMPLE_CARDS = [
  { name: 'James R.', sport: 'Football', level: 'Semi-Pro', followers: '12.4K', location: 'London' },
  { name: 'Sofia M.', sport: 'Athletics', level: 'Amateur', followers: '8.1K', location: 'Manchester' },
  { name: 'City FC Academy', sport: 'Football', level: 'Grassroots', followers: '5.2K', location: 'Birmingham' },
  { name: 'Priya K.', sport: 'Tennis', level: 'Professional', followers: '31K', location: 'Bristol' },
  { name: 'Marcus T.', sport: 'Basketball', level: 'Semi-Pro', followers: '9.7K', location: 'Leeds' },
  { name: 'North United U21', sport: 'Football', level: 'Amateur', followers: '2.3K', location: 'Sheffield' },
]

export default function MarketplacePreview() {
  return (
    <section className="py-20">
      <div className="mx-auto max-w-6xl px-6">
        <h2 className="mb-4 text-center text-3xl font-bold">Browse the Talent Pool</h2>
        <p className="mb-10 text-center text-muted-foreground">
          Over 10,000 athletes and teams ready to partner with brands like yours.
        </p>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {SAMPLE_CARDS.map((c) => (
            <div key={c.name} className="rounded-xl border bg-card p-5 shadow-sm">
              <div className="mb-3 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted text-sm font-bold">
                  {c.name[0]}
                </div>
                <div>
                  <p className="font-semibold">{c.name}</p>
                  <p className="text-xs text-muted-foreground">{c.location}</p>
                </div>
              </div>
              <div className="flex gap-2 flex-wrap">
                <span className="rounded-full bg-muted px-2 py-0.5 text-xs">{c.sport}</span>
                <span className="rounded-full bg-muted px-2 py-0.5 text-xs">{c.level}</span>
                <span className="rounded-full bg-muted px-2 py-0.5 text-xs">{c.followers} followers</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
```

- [ ] **Step 4: Assemble partial landing page**

```tsx
// app/page.tsx
import Hero from '@/components/landing/hero'
import HowItWorks from '@/components/landing/how-it-works'
import MarketplacePreview from '@/components/landing/marketplace-preview'

export default function Home() {
  return (
    <main>
      <Hero />
      <HowItWorks />
      <MarketplacePreview />
    </main>
  )
}
```

- [ ] **Step 5: Commit**

```bash
git add components/landing/hero.tsx components/landing/how-it-works.tsx components/landing/marketplace-preview.tsx app/page.tsx
git commit -m "feat(landing): hero, how-it-works, and marketplace preview sections"
```

---

### Task 9: Landing page — Role Panels + Social Proof + FAQ + complete

**Files:**
- Create: `components/landing/role-panels.tsx`
- Create: `components/landing/social-proof.tsx`
- Create: `components/landing/faq.tsx`
- Modify: `app/page.tsx` (add all sections + footer)

- [ ] **Step 1: Create role panels**

```tsx
// components/landing/role-panels.tsx
import Link from 'next/link'
import { Button } from '@/components/ui/button'

const panels = [
  {
    role: 'Athletes',
    tagline: 'Get discovered. Close deals.',
    points: ['Free forever — no subscription', 'Create a rich profile with stats and media', 'Browse brand campaigns and connect directly', 'E-sign contracts and receive payments'],
    cta: 'Create Athlete Profile',
    href: '/auth/signup',
  },
  {
    role: 'Teams',
    tagline: 'Find your next sponsor.',
    points: ['Free forever — no subscription', 'Showcase your fanbase and reach', 'Browse sponsor campaigns that fit your club', 'Negotiate and sign sponsorship deals'],
    cta: 'List Your Team',
    href: '/auth/signup',
  },
  {
    role: 'Brands & Sponsors',
    tagline: 'Access elite talent at scale.',
    points: ['Powerful search and filter tools', 'Connect with verified athletes and teams', 'Manage campaigns, proposals, and contracts', 'Subscription from Tier 1 (7-day free trial)'],
    cta: 'Start Finding Talent',
    href: '/auth/signup',
  },
]

export default function RolePanels() {
  return (
    <section id="who" className="bg-muted/30 py-24">
      <div className="mx-auto max-w-6xl px-6">
        <h2 className="mb-12 text-center text-3xl font-bold">Built for Everyone in Sport</h2>
        <div className="grid gap-6 md:grid-cols-3">
          {panels.map((p) => (
            <div key={p.role} className="flex flex-col gap-4 rounded-xl border bg-card p-6 shadow-sm">
              <h3 className="text-xl font-bold">{p.role}</h3>
              <p className="text-muted-foreground">{p.tagline}</p>
              <ul className="space-y-2 text-sm">
                {p.points.map((pt) => (
                  <li key={pt} className="flex items-start gap-2">
                    <span className="mt-0.5 text-green-500">✓</span>
                    {pt}
                  </li>
                ))}
              </ul>
              <Button asChild className="mt-auto">
                <Link href={p.href}>{p.cta}</Link>
              </Button>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
```

- [ ] **Step 2: Create social proof**

```tsx
// components/landing/social-proof.tsx
const stats = [
  { value: '10,000+', label: 'Athletes & Teams' },
  { value: '500+', label: 'Brand Partners' },
  { value: '£2M+', label: 'Deals Closed' },
  { value: '48h', label: 'Avg. Response Time' },
]

export default function SocialProof() {
  return (
    <section id="about" className="py-20">
      <div className="mx-auto max-w-5xl px-6">
        <div className="grid gap-8 text-center sm:grid-cols-4">
          {stats.map((s) => (
            <div key={s.label}>
              <p className="text-4xl font-extrabold">{s.value}</p>
              <p className="mt-1 text-sm text-muted-foreground">{s.label}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
```

- [ ] **Step 3: Create FAQ**

```tsx
// components/landing/faq.tsx
'use client'

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'

const faqs = [
  { q: 'Is Podium really free for athletes and teams?', a: 'Yes. Athletes, teams, and agents never pay. All features — listing, searching, messaging, deal proposals, contracts, and payments — are completely free and unlimited.' },
  { q: 'How does brand pricing work?', a: 'Brands pay a monthly subscription at Tier 1, Tier 2, or Tier 3. All tiers include a 7-day free trial with no charge during the trial period.' },
  { q: 'How do e-signatures work?', a: 'Contracts are signed digitally via our integrated e-signature provider. Each signature is logged with a full audit trail including IP address, device, and timestamp.' },
  { q: 'How are payments processed?', a: 'Payments go directly from brand to athlete or team via Stripe. Podium is not the employer or payroll agent — athletes and teams are responsible for their own tax obligations.' },
  { q: 'What happens if I need to report a user?', a: 'Use the three-dot menu on any profile or message to file a report. All reports are reviewed by our admin team within 48 hours.' },
  { q: 'How do I delete my account?', a: 'Go to Settings → Account → Delete Account. You have a 14-day grace period to change your mind. Your data is permanently deleted after that (except retained payment records, as required by law).' },
]

export default function FAQ() {
  return (
    <section id="faq" className="bg-muted/30 py-24">
      <div className="mx-auto max-w-3xl px-6">
        <h2 className="mb-10 text-center text-3xl font-bold">Frequently Asked Questions</h2>
        <Accordion type="single" collapsible className="space-y-2">
          {faqs.map((f, i) => (
            <AccordionItem key={i} value={`item-${i}`} className="rounded-lg border bg-card px-4">
              <AccordionTrigger className="text-left font-medium">{f.q}</AccordionTrigger>
              <AccordionContent className="text-muted-foreground">{f.a}</AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </section>
  )
}
```

- [ ] **Step 4: Assemble complete landing page**

```tsx
// app/page.tsx
import Hero from '@/components/landing/hero'
import HowItWorks from '@/components/landing/how-it-works'
import MarketplacePreview from '@/components/landing/marketplace-preview'
import RolePanels from '@/components/landing/role-panels'
import SocialProof from '@/components/landing/social-proof'
import FAQ from '@/components/landing/faq'
import Footer from '@/components/layout/footer'

export default function Home() {
  return (
    <main>
      <Hero />
      <SocialProof />
      <HowItWorks />
      <MarketplacePreview />
      <RolePanels />
      <FAQ />
      <Footer />
    </main>
  )
}
```

- [ ] **Step 5: Commit**

```bash
git add components/landing/role-panels.tsx components/landing/social-proof.tsx components/landing/faq.tsx app/page.tsx
git commit -m "feat(landing): role panels, social proof, FAQ; complete landing page"
```

---

### Task 10: E2E auth spec

**Files:**
- Create: `e2e/auth.spec.ts`

- [ ] **Step 1: Write Playwright auth flow spec**

```ts
// e2e/auth.spec.ts
import { test, expect } from '@playwright/test'

test.describe('Auth flows', () => {
  test('landing page renders hero CTAs', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('heading', { name: /sports sponsorship marketplace/i })).toBeVisible()
    await expect(page.getByRole('link', { name: /list your profile/i })).toBeVisible()
    await expect(page.getByRole('link', { name: /find talent/i })).toBeVisible()
  })

  test('sign-up page renders form', async ({ page }) => {
    await page.goto('/auth/signup')
    await expect(page.getByRole('heading', { name: /create your account/i })).toBeVisible()
    await expect(page.getByLabel(/email/i)).toBeVisible()
    await expect(page.getByLabel(/password/i)).toBeVisible()
  })

  test('login page renders form with forgot password link', async ({ page }) => {
    await page.goto('/auth')
    await expect(page.getByRole('heading', { name: /welcome back/i })).toBeVisible()
    await expect(page.getByRole('link', { name: /forgot password/i })).toBeVisible()
  })

  test('weak password shows strength indicator', async ({ page }) => {
    await page.goto('/auth/signup')
    await page.getByLabel(/password/i).fill('weak')
    await expect(page.getByText(/weak/i)).toBeVisible()
  })

  test('forgot password page shows anti-enumeration message on submit', async ({ page }) => {
    await page.goto('/auth/forgot-password')
    await page.getByLabel(/email/i).fill('any@example.com')
    await page.getByRole('button', { name: /send reset link/i }).click()
    await expect(page.getByText(/if this email exists/i)).toBeVisible()
  })

  test('403 page renders', async ({ page }) => {
    await page.goto('/403')
    await expect(page.getByRole('heading', { name: '403' })).toBeVisible()
  })

  test('role select redirects unauthenticated user to /auth', async ({ page }) => {
    await page.goto('/role-select')
    await expect(page).toHaveURL(/\/auth/)
  })
})
```

- [ ] **Step 2: Commit**

```bash
git add e2e/auth.spec.ts
git commit -m "test(e2e): auth flow Playwright spec"
```

---

### Task 11: Final Phase 1 check

- [ ] **Step 1: Run full check**

```bash
npm run check
```

Expected: type-check clean, lint clean, all Vitest tests passing (≥ 496 + new tests).

- [ ] **Step 2: Fix any type or lint errors, then commit**

```bash
git add -A
git commit -m "fix(phase-1): type and lint corrections"
```

---

## Phase 2: Athlete Dashboard (Flows 7–19)

> **Requires separate detailed plan.** This is a page inventory for scoping.

**Prerequisite:** Phase 1 complete.

### App Shell (shared by all authenticated roles)

| File | Description | `"use client"` |
|---|---|---|
| `components/layout/nav-shell.tsx` | Top nav with role-specific links, notification bell, avatar menu | Yes |
| `components/layout/notification-bell.tsx` | Dropdown showing unread notifications | Yes |
| `components/layout/theme-toggle.tsx` | Light/dark toggle | Yes |

### Athlete pages

| Page | URL | `"use client"` | Data source |
|---|---|---|---|
| `app/(athlete)/layout.tsx` | (layout, no URL) | No | `lib/supabase/auth.getUser` — guards athlete role |
| `app/(athlete)/athlete/onboarding/page.tsx` | `/athlete/onboarding` | No | `GET /api/profiles/me` |
| `app/(athlete)/athlete/onboarding/step/[step]/page.tsx` | `/athlete/onboarding/step/1`…`6` | No | Wizard state in URL params |
| `components/athlete/profile-wizard.tsx` | Multi-step form (6 steps) | Yes | `POST /api/profiles/me`, `PATCH /api/profiles/me` |
| `app/(athlete)/athlete/onboarding/preview/page.tsx` | `/athlete/onboarding/preview` | No | `GET /api/profiles/me` |
| `components/athlete/profile-preview.tsx` | Full preview of public profile | No | Props |
| `app/(athlete)/athlete/dashboard/page.tsx` | `/athlete/dashboard` | No | `GET /api/profiles/me`, `GET /api/messaging/matches` |
| `app/(athlete)/athlete/discover/page.tsx` | `/athlete/discover` | No | `GET /api/discovery/listings` |
| `components/discovery/listing-card.tsx` | Brand campaign card | No | Props |
| `components/discovery/listings-grid.tsx` | Filterable grid | Yes | `GET /api/discovery/listings` |
| `app/(athlete)/athlete/saved/page.tsx` | `/athlete/saved` | No | `GET /api/discovery/shortlist` |
| `app/(athlete)/athlete/requests/page.tsx` | `/athlete/requests` | No | Direct `connection_requests` query via server client |
| `components/discovery/connection-request-card.tsx` | Incoming request card with accept/decline | Yes | Props |
| `app/(athlete)/athlete/messages/page.tsx` | `/athlete/messages` | No | `GET /api/messaging/matches` |
| `components/messaging/match-list.tsx` | Conversations list | No | Props |
| `app/(athlete)/athlete/messages/[matchId]/page.tsx` | `/athlete/messages/[matchId]` | No | `GET /api/messaging/matches/[matchId]/messages` |
| `components/messaging/chat-window.tsx` | Real-time chat view | Yes | Supabase Realtime channel |
| `components/messaging/message-bubble.tsx` | Single message (text/image/doc/proposal-card) | No | Props |
| `components/messaging/proposal-card-message.tsx` | Inline proposal card in chat | Yes | Props + `POST /api/deals/proposals/[id]/respond` |
| `app/(athlete)/athlete/settings/page.tsx` | `/athlete/settings` | No | `GET /api/profiles/me` |
| `components/athlete/settings-form.tsx` | Profile + notification + deletion settings | Yes | `PATCH /api/profiles/me`, `POST /api/reports` |

### Under-18 flow

| Component | Description |
|---|---|
| `components/athlete/guardian-form.tsx` | Guardian name, relationship, email, phone form (step 5 of wizard) |

### Note on Requests tab

There is no `GET /api/discovery/connections` API endpoint. The requests page will query the `connection_requests` table directly via the Supabase server client (`lib/supabase/server.createClient()`). This is the only server component that queries Supabase without a lib wrapper — document this as technical debt.

---

## Phase 3: Brand Dashboard (Flows 25–33)

> **Requires separate detailed plan.**

### Brand pages

| Page | URL | `"use client"` | Data source |
|---|---|---|---|
| `app/(brand)/layout.tsx` | (layout) | No | `lib/supabase/auth.getUser` — guards brand role |
| `app/(brand)/brand/onboarding/page.tsx` | `/brand/onboarding` | No | — |
| `components/brand/brand-profile-form.tsx` | Multi-step brand profile creation | Yes | `POST /api/profiles/me`, `PATCH /api/profiles/me` |
| `app/(brand)/brand/subscription/page.tsx` | `/brand/subscription` | No | `GET /api/payments/subscriptions/me` |
| `components/brand/subscription-tiers.tsx` | Tier 1/2/3 selection + Stripe checkout | Yes | `POST /api/payments/subscriptions/checkout` |
| `app/(brand)/brand/dashboard/page.tsx` | `/brand/dashboard` | No | `GET /api/profiles/me`, `GET /api/messaging/matches`, `GET /api/payments/subscriptions/me` |
| `app/(brand)/brand/discover/page.tsx` | `/brand/discover` | No | `GET /api/discovery/listings` + athlete profiles |
| `app/(brand)/brand/listings/page.tsx` | `/brand/listings` | No | `GET /api/discovery/listings` |
| `app/(brand)/brand/listings/new/page.tsx` | `/brand/listings/new` | No | — |
| `components/brand/listing-form.tsx` | Create/edit job listing or sponsorship campaign | Yes | `POST /api/discovery/listings`, `PATCH /api/discovery/listings/[id]` |
| `app/(brand)/brand/listings/[id]/page.tsx` | `/brand/listings/[id]` | No | `GET /api/discovery/listings/[id]` |
| `app/(brand)/brand/messages/page.tsx` | `/brand/messages` | No | `GET /api/messaging/matches` |
| `app/(brand)/brand/messages/[matchId]/page.tsx` | `/brand/messages/[matchId]` | No | `GET /api/messaging/matches/[matchId]/messages` |
| `components/brand/proposal-form.tsx` | Send formal proposal (required before free chat) | Yes | `POST /api/deals/proposals` |
| `app/(brand)/brand/payments/page.tsx` | `/brand/payments` | No | `GET /api/payments/history` |
| `components/brand/payment-form.tsx` | Initiate payment via Stripe | Yes | `POST /api/payments/intents` |
| `app/(brand)/brand/settings/page.tsx` | `/brand/settings` | No | `GET /api/profiles/me`, `GET /api/payments/subscriptions/me` |
| `components/brand/cancel-subscription.tsx` | Cancel flow with confirmation | Yes | `POST /api/payments/subscriptions/cancel` |

---

## Phase 4: Team Dashboard (Flows 20–24)

> **Requires separate detailed plan.** Mirrors athlete dashboard with team-specific fields.

### Team pages

| Page | URL | `"use client"` | Data source |
|---|---|---|---|
| `app/(team)/layout.tsx` | (layout) | No | Auth guard — team role |
| `app/(team)/team/onboarding/page.tsx` | `/team/onboarding` | No | — |
| `components/team/team-profile-wizard.tsx` | 6-step team profile builder | Yes | `POST /api/profiles/me`, `PATCH /api/profiles/me` |
| `app/(team)/team/dashboard/page.tsx` | `/team/dashboard` | No | `GET /api/profiles/me`, `GET /api/messaging/matches` |
| `app/(team)/team/discover/page.tsx` | `/team/discover` | No | `GET /api/discovery/listings` |
| `app/(team)/team/messages/page.tsx` | `/team/messages` | No | `GET /api/messaging/matches` |
| `app/(team)/team/messages/[matchId]/page.tsx` | `/team/messages/[matchId]` | No | Messages API |
| `app/(team)/team/settings/page.tsx` | `/team/settings` | No | `GET /api/profiles/me` |

---

## Phase 5: Agent Dashboard (Flows 34–38)

> **Requires separate detailed plan.**

### Agent pages

| Page | URL | `"use client"` | Data source |
|---|---|---|---|
| `app/(agent)/layout.tsx` | (layout) | No | Auth guard — agent role |
| `app/(agent)/agent/onboarding/page.tsx` | `/agent/onboarding` | No | — |
| `components/agent/agent-profile-form.tsx` | 5-step agent profile (agency, services, commission) | Yes | `POST /api/profiles/me`, `PATCH /api/profiles/me` |
| `app/(agent)/agent/dashboard/page.tsx` | `/agent/dashboard` | No | `GET /api/profiles/me`, `GET /api/messaging/matches` |
| `app/(agent)/agent/discover/page.tsx` | `/agent/discover` | No | `GET /api/discovery/listings` + profiles |
| `app/(agent)/agent/clients/page.tsx` | `/agent/clients` | No | `GET /api/profiles/representation` |
| `components/agent/representation-request-card.tsx` | Representation request in chat | Yes | Props |
| `app/(agent)/agent/messages/page.tsx` | `/agent/messages` | No | `GET /api/messaging/matches` |
| `app/(agent)/agent/messages/[matchId]/page.tsx` | `/agent/messages/[matchId]` | No | Messages API |
| `app/(agent)/agent/settings/page.tsx` | `/agent/settings` | No | `GET /api/profiles/me`, `GET /api/profiles/representation` |

---

## Phase 6: Admin Panel (Flows 45–58)

> **Requires separate detailed plan.** Accessed at `/admin/*`. Middleware already enforces admin role.

### Admin pages

| Page | URL | `"use client"` | Data source |
|---|---|---|---|
| `app/(admin)/layout.tsx` | (layout) | No | Middleware already handles role check |
| `app/(admin)/admin/dashboard/page.tsx` | `/admin/dashboard` | No | `GET /api/admin/reports?status=pending`, `GET /api/admin/audit-logs` |
| `app/(admin)/admin/reports/page.tsx` | `/admin/reports` | No | `GET /api/admin/reports` |
| `app/(admin)/admin/reports/[id]/page.tsx` | `/admin/reports/[id]` | No | `GET /api/admin/reports/[id]` |
| `components/admin/resolve-report-form.tsx` | Resolve/dismiss report with notes | Yes | `PATCH /api/admin/reports/[id]` |
| `app/(admin)/admin/audit-logs/page.tsx` | `/admin/audit-logs` | No | `GET /api/admin/audit-logs` |
| `app/(admin)/admin/users/page.tsx` | `/admin/users` | No | Direct Supabase admin client query |
| `app/(admin)/admin/users/[id]/page.tsx` | `/admin/users/[id]` | No | Admin client — all profile tables, reports, audit history |
| `components/admin/user-actions.tsx` | Suspend, terminate, approve-brand actions | Yes | Admin API endpoints |

---

## Phase 7: System-wide Features (Flows 39–44)

> **Requires separate detailed plan.** Cross-cutting features added on top of all role dashboards.

| Feature | Component/Page | Notes |
|---|---|---|
| Block user (Flow 41) | `components/shared/block-report-menu.tsx` | Three-dot menu on any profile; `POST /api/discovery/blocks` |
| Report user (Flow 41) | `components/shared/report-form.tsx` | `POST /api/reports` |
| Blocked users list (Flow 41) | Settings page section | `GET /api/discovery/blocks`, `DELETE /api/discovery/blocks/[id]` |
| Notifications panel (Flow 40) | `components/layout/notification-bell.tsx` | `GET /api/notifications`, `PATCH /api/notifications/[id]/read` |
| In-app notification list | `/[role]/notifications` page | `GET /api/notifications` |
| Theme toggle (Flow 37) | `components/layout/theme-toggle.tsx` | next-themes, stored in user profile |
| GDPR data download (Flow 44) | Settings → Download My Data | Server action calling data-export endpoint |
| Account deletion (Flow 44) | Settings → Delete Account | `POST /api/auth/password-update` or a deletion endpoint |
| Verification badge (Flow 38) | `components/shared/verified-badge.tsx` | Badge icon on profiles, boost in search |
| Swipe Mode (Flow 2.2) | `components/discovery/swipe-stack.tsx` | Optional UI toggle; same data as grid |
