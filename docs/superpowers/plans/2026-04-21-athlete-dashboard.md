# Podium Phase 2 — Athlete Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the complete athlete experience — shared app shell (nav, notifications, theme), 6-step onboarding wizard, dashboard, brand discovery, saved, connection requests, real-time messaging, and settings.

**Architecture:** Server components own data-fetching and auth-guard logic, passing typed props to client components. `"use client"` only for forms, real-time chat, and interactive UI. Client components call `/api/*` routes for mutations — never Supabase directly. All lib access in server components only.

**Tech Stack:** Next.js 15 App Router · TypeScript strict · Tailwind 4 · shadcn/ui · react-hook-form + zod · Supabase JS 2.x · Supabase Realtime (browser client) · lucide-react · sonner

---

## Rules (enforced across all tasks)

- **No `<Button asChild>`** — Button uses `@base-ui/react`, not Radix. For link-styled buttons use `<Link className={buttonVariants({ variant, size })}>` imported from `@/components/ui/button`.
- **No Supabase calls in `"use client"` files** — client components call `/api/*` routes only.
- **Server components fetch** — pass data as typed props to client children.
- **Types from `types/database.ts`** — never inline DB types.

---

## File Map

| File | Role | Client? |
|---|---|---|
| `components/layout/theme-toggle.tsx` | Light/dark toggle button | Yes |
| `components/layout/notification-bell.tsx` | Unread notification dropdown | Yes |
| `components/layout/nav-shell.tsx` | Role-aware top nav bar | Yes |
| `app/(athlete)/layout.tsx` | Auth + role guard, renders NavShell | No |
| `app/(athlete)/athlete/onboarding/page.tsx` | Redirect to step/1 | No |
| `app/(athlete)/athlete/onboarding/step/[step]/page.tsx` | Fetch profile, render wizard | No |
| `components/athlete/profile-wizard.tsx` | 6-step onboarding form | Yes |
| `components/athlete/profile-wizard.test.tsx` | Unit tests for wizard | — |
| `components/athlete/guardian-form.tsx` | Under-18 guardian sub-form | Yes |
| `app/(athlete)/athlete/onboarding/preview/page.tsx` | Fetch + render profile preview | No |
| `components/athlete/profile-preview.tsx` | Public profile card display | No |
| `app/(athlete)/athlete/dashboard/page.tsx` | Athlete home | No |
| `app/(athlete)/athlete/discover/page.tsx` | Brand listings browse | No |
| `components/discovery/listing-card.tsx` | Single listing card | No |
| `components/discovery/listings-grid.tsx` | Filterable listings grid | Yes |
| `components/discovery/listings-grid.test.tsx` | Filter/render tests | — |
| `app/(athlete)/athlete/saved/page.tsx` | Shortlisted brands | No |
| `app/(athlete)/athlete/requests/page.tsx` | Incoming connection requests | No |
| `components/discovery/connection-request-card.tsx` | Accept/decline card | Yes |
| `components/discovery/connection-request-card.test.tsx` | Tests | — |
| `app/(athlete)/athlete/messages/page.tsx` | Conversations list | No |
| `components/messaging/match-list.tsx` | Match list display | No |
| `app/(athlete)/athlete/messages/[matchId]/page.tsx` | Chat view shell | No |
| `components/messaging/message-bubble.tsx` | Single message display | No |
| `components/messaging/proposal-card-message.tsx` | Proposal card in chat | Yes |
| `components/messaging/chat-window.tsx` | Real-time chat with Realtime | Yes |
| `app/(athlete)/athlete/settings/page.tsx` | Settings page | No |
| `components/athlete/settings-form.tsx` | Profile + notification settings | Yes |
| `components/athlete/settings-form.test.tsx` | Tests | — |

---

## Task 1: App shell — theme toggle

**Files:**
- Create: `components/layout/theme-toggle.tsx`

- [ ] **Step 1: Create theme toggle**

```tsx
// components/layout/theme-toggle.tsx
'use client'

import { useTheme } from 'next-themes'
import { Sun, Moon } from 'lucide-react'
import { Button } from '@/components/ui/button'

export default function ThemeToggle() {
  const { theme, setTheme } = useTheme()
  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
      aria-label="Toggle theme"
    >
      <Sun className="size-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
      <Moon className="absolute size-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
    </Button>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add components/layout/theme-toggle.tsx
git commit -m "feat(shell): theme toggle component"
```

---

## Task 2: App shell — notification bell

**Files:**
- Create: `components/layout/notification-bell.tsx`
- Create: `components/layout/notification-bell.test.tsx`

- [ ] **Step 1: Write failing test**

```tsx
// components/layout/notification-bell.test.tsx
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import NotificationBell from './notification-bell'

describe('NotificationBell', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })

  it('shows 0 badge when no unread notifications', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => [],
    } as Response)
    render(<NotificationBell />)
    await waitFor(() => expect(fetch).toHaveBeenCalledWith('/api/notifications'))
    expect(screen.queryByRole('status')).toBeNull()
  })

  it('shows unread count badge', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => [
        { id: '1', title: 'Hello', body: 'You got a match', read_at: null, created_at: '2024-01-01', event_type: 'match', channel: 'in_app', metadata: {}, sent_at: '2024-01-01', user_id: 'u1' },
        { id: '2', title: 'Offer', body: 'Brand sent proposal', read_at: null, created_at: '2024-01-02', event_type: 'proposal', channel: 'in_app', metadata: {}, sent_at: '2024-01-02', user_id: 'u1' },
      ],
    } as Response)
    render(<NotificationBell />)
    await waitFor(() => expect(screen.getByRole('status')).toBeInTheDocument())
    expect(screen.getByRole('status')).toHaveTextContent('2')
  })

  it('opens dropdown on click and shows notification titles', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => [
        { id: '1', title: 'New match', body: 'Nike wants to connect', read_at: null, created_at: '2024-01-01', event_type: 'match', channel: 'in_app', metadata: {}, sent_at: '2024-01-01', user_id: 'u1' },
      ],
    } as Response)
    render(<NotificationBell />)
    await waitFor(() => expect(fetch).toHaveBeenCalled())
    await userEvent.click(screen.getByRole('button', { name: /notifications/i }))
    expect(screen.getByText('New match')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test — verify it fails**

```bash
npm run test -- notification-bell
```

Expected: FAIL — `NotificationBell` not found.

- [ ] **Step 3: Implement notification bell**

```tsx
// components/layout/notification-bell.tsx
'use client'

import { useEffect, useRef, useState } from 'react'
import { Bell } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { Database } from '@/types/database'

type NotificationRow = Database['public']['Tables']['notification_logs']['Row']

export default function NotificationBell() {
  const [notifications, setNotifications] = useState<NotificationRow[]>([])
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fetch('/api/notifications')
      .then((r) => r.json())
      .then((data: NotificationRow[]) => setNotifications(data))
      .catch(() => {})
  }, [])

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const unread = notifications.filter((n) => !n.read_at)

  return (
    <div ref={ref} className="relative">
      <Button
        variant="ghost"
        size="icon"
        aria-label="Notifications"
        onClick={() => setOpen((o) => !o)}
      >
        <Bell className="size-4" />
        {unread.length > 0 && (
          <span
            role="status"
            className="absolute -right-0.5 -top-0.5 flex size-4 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-white"
          >
            {unread.length > 9 ? '9+' : unread.length}
          </span>
        )}
      </Button>

      {open && (
        <div className="absolute right-0 top-10 z-50 w-80 rounded-xl border bg-card shadow-lg">
          <div className="border-b px-4 py-2 text-sm font-semibold">Notifications</div>
          {notifications.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-muted-foreground">No notifications yet</p>
          ) : (
            <ul className="max-h-80 overflow-y-auto divide-y">
              {notifications.map((n) => (
                <li key={n.id} className={`px-4 py-3 ${!n.read_at ? 'bg-muted/40' : ''}`}>
                  <p className="text-sm font-medium">{n.title}</p>
                  <p className="text-xs text-muted-foreground">{n.body}</p>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Run test — verify it passes**

```bash
npm run test -- notification-bell
```

Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add components/layout/notification-bell.tsx components/layout/notification-bell.test.tsx
git commit -m "feat(shell): notification bell with unread count"
```

---

## Task 3: App shell — nav shell + athlete layout

**Files:**
- Create: `components/layout/nav-shell.tsx`
- Create: `app/(athlete)/layout.tsx`

- [ ] **Step 1: Create NavShell**

```tsx
// components/layout/nav-shell.tsx
'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { buttonVariants } from '@/components/ui/button'
import NotificationBell from './notification-bell'
import ThemeToggle from './theme-toggle'

interface NavLink { label: string; href: string }

interface NavShellProps {
  role: 'athlete' | 'team' | 'brand' | 'agent' | 'admin'
  children: React.ReactNode
}

const NAV_LINKS: Record<NavShellProps['role'], NavLink[]> = {
  athlete: [
    { label: 'Dashboard', href: '/athlete/dashboard' },
    { label: 'Discover', href: '/athlete/discover' },
    { label: 'Saved', href: '/athlete/saved' },
    { label: 'Requests', href: '/athlete/requests' },
    { label: 'Messages', href: '/athlete/messages' },
  ],
  team: [
    { label: 'Dashboard', href: '/team/dashboard' },
    { label: 'Discover', href: '/team/discover' },
    { label: 'Messages', href: '/team/messages' },
  ],
  brand: [
    { label: 'Dashboard', href: '/brand/dashboard' },
    { label: 'Discover', href: '/brand/discover' },
    { label: 'Listings', href: '/brand/listings' },
    { label: 'Messages', href: '/brand/messages' },
  ],
  agent: [
    { label: 'Dashboard', href: '/agent/dashboard' },
    { label: 'Clients', href: '/agent/clients' },
    { label: 'Discover', href: '/agent/discover' },
    { label: 'Messages', href: '/agent/messages' },
  ],
  admin: [
    { label: 'Dashboard', href: '/admin/dashboard' },
    { label: 'Reports', href: '/admin/reports' },
    { label: 'Users', href: '/admin/users' },
    { label: 'Audit', href: '/admin/audit-logs' },
  ],
}

export default function NavShell({ role, children }: NavShellProps) {
  const pathname = usePathname()
  const links = NAV_LINKS[role]

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-7xl items-center gap-4 px-4">
          <Link href={`/${role}/dashboard`} className="mr-4 text-lg font-bold tracking-tight">
            Podium
          </Link>
          <nav className="flex items-center gap-1">
            {links.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className={cn(
                  buttonVariants({ variant: 'ghost', size: 'sm' }),
                  pathname === l.href && 'bg-muted font-semibold'
                )}
              >
                {l.label}
              </Link>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <NotificationBell />
            <ThemeToggle />
            <Link
              href={`/${role}/settings`}
              className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }))}
            >
              Settings
            </Link>
          </div>
        </div>
      </header>
      <main className="flex-1">{children}</main>
    </div>
  )
}
```

- [ ] **Step 2: Create athlete layout**

```tsx
// app/(athlete)/layout.tsx
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getUser } from '@/lib/supabase/auth'
import NavShell from '@/components/layout/nav-shell'

export default async function AthleteLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const user = await getUser(supabase)

  if (!user) redirect('/auth')
  if (user.role !== 'athlete') redirect('/403')

  return <NavShell role="athlete">{children}</NavShell>
}
```

- [ ] **Step 3: Type-check**

```bash
npm run type-check
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add components/layout/nav-shell.tsx "app/(athlete)/layout.tsx"
git commit -m "feat(shell): nav shell with role-aware links and athlete layout guard"
```

---

## Task 4: Athlete onboarding routes + wizard skeleton (step 1 — basic info)

**Files:**
- Create: `app/(athlete)/athlete/onboarding/page.tsx`
- Create: `app/(athlete)/athlete/onboarding/step/[step]/page.tsx`
- Create: `components/athlete/profile-wizard.tsx`
- Create: `components/athlete/profile-wizard.test.tsx`

The wizard is a single `"use client"` component that receives the current `step` (1–6) and the existing `profile` (or `null`). It manages form state and saves progress via API. Step 6 is "Review & Publish". Guardian step (5) is skipped if `profile.is_under_18 === false`.

Wizard step map:
- Step 1: Basic info (`display_name`, `full_legal_name`, `date_of_birth`, `phone`, `home_city`, `home_country`)
- Step 2: Sport (`primary_sport`, `secondary_sport`, `level`, `position`, `years_active`, `height_cm`, `weight_kg`)
- Step 3: Availability (`availability_status`, `available_from_date`, `travel_radius_km`, `seeking`)
- Step 4: Social & Bio (`social_accounts`, `notable_achievements`)
- Step 5: Guardian — only if `is_under_18` (`guardian_name`, `guardian_relationship`, `guardian_email`, `guardian_phone`)
- Step 6: Review & Publish

- [ ] **Step 1: Write failing tests**

```tsx
// components/athlete/profile-wizard.test.tsx
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import ProfileWizard from './profile-wizard'

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }))

describe('ProfileWizard', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ user_id: 'u1', is_under_18: false, status: 'draft' }),
    }))
  })

  it('step 1: shows basic info fields', () => {
    render(<ProfileWizard step={1} profile={null} />)
    expect(screen.getByLabelText(/display name/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/date of birth/i)).toBeInTheDocument()
  })

  it('step 1: shows validation error for missing display name', async () => {
    render(<ProfileWizard step={1} profile={null} />)
    await userEvent.click(screen.getByRole('button', { name: /next/i }))
    expect(await screen.findByText(/display name is required/i)).toBeInTheDocument()
  })

  it('step 1: calls POST /api/profiles/me on first submit when profile is null', async () => {
    render(<ProfileWizard step={1} profile={null} />)
    await userEvent.type(screen.getByLabelText(/display name/i), 'James')
    await userEvent.type(screen.getByLabelText(/date of birth/i), '1998-05-12')
    await userEvent.click(screen.getByRole('button', { name: /next/i }))
    await waitFor(() =>
      expect(fetch).toHaveBeenCalledWith('/api/profiles/me', expect.objectContaining({ method: 'POST' }))
    )
  })

  it('step 5: guardian step is skipped when is_under_18 is false', () => {
    const profile = {
      user_id: 'u1', is_under_18: false, display_name: 'James', status: 'draft',
      guardian_name: null, guardian_email: null, guardian_phone: null, guardian_relationship: null,
    }
    render(<ProfileWizard step={5} profile={profile as never} />)
    expect(screen.queryByLabelText(/guardian/i)).toBeNull()
    expect(screen.getByText(/this step is not required/i)).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test — verify it fails**

```bash
npm run test -- profile-wizard
```

Expected: FAIL — `ProfileWizard` not found.

- [ ] **Step 3: Create wizard component**

```tsx
// components/athlete/profile-wizard.tsx
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import GuardianForm, { type GuardianValues } from './guardian-form'
import type { Database } from '@/types/database'

type AthleteRow = Database['public']['Tables']['athlete_profiles']['Row']
type AthleteLevel = Database['public']['Enums']['athlete_level']
type AvailabilityStatus = Database['public']['Enums']['availability_status']

// ─── Schemas ─────────────────────────────────────────────────────────────────

const step1Schema = z.object({
  display_name: z.string().min(1, 'Display name is required').max(50),
  full_legal_name: z.string().optional(),
  date_of_birth: z.string().optional(),
  phone: z.string().optional(),
  home_city: z.string().optional(),
  home_country: z.string().optional(),
})

const step2Schema = z.object({
  primary_sport: z.string().min(1, 'Primary sport is required'),
  secondary_sport: z.string().optional(),
  level: z.enum(['recreational', 'amateur', 'semi_professional', 'professional', 'international'] as const).optional(),
  position: z.string().optional(),
  years_active: z.coerce.number().int().min(0).max(50).optional(),
  height_cm: z.coerce.number().int().min(100).max(250).optional(),
  weight_kg: z.coerce.number().min(30).max(200).optional(),
})

const step3Schema = z.object({
  availability_status: z.enum(['available_now', 'available_from', 'not_available'] as const).optional(),
  available_from_date: z.string().optional(),
  travel_radius_km: z.coerce.number().int().min(0).max(20000).optional(),
  seeking: z.array(z.string()).optional(),
})

const step4Schema = z.object({
  instagram: z.string().url('Must be a valid URL').optional().or(z.literal('')),
  tiktok: z.string().url('Must be a valid URL').optional().or(z.literal('')),
  youtube: z.string().url('Must be a valid URL').optional().or(z.literal('')),
  twitter: z.string().url('Must be a valid URL').optional().or(z.literal('')),
  notable_achievements: z.string().max(1000).optional(),
})

type Step1Values = z.infer<typeof step1Schema>
type Step2Values = z.infer<typeof step2Schema>
type Step3Values = z.infer<typeof step3Schema>
type Step4Values = z.infer<typeof step4Schema>

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  step: number
  profile: AthleteRow | null
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const SEEKING_OPTIONS = [
  { value: 'endorsement', label: 'Endorsement' },
  { value: 'sponsorship', label: 'Sponsorship' },
  { value: 'ambassador', label: 'Brand Ambassador' },
  { value: 'media_appearance', label: 'Media Appearance' },
  { value: 'product_deal', label: 'Product Deal' },
]

const LEVEL_OPTIONS: { value: AthleteLevel; label: string }[] = [
  { value: 'recreational', label: 'Recreational' },
  { value: 'amateur', label: 'Amateur' },
  { value: 'semi_professional', label: 'Semi-Professional' },
  { value: 'professional', label: 'Professional' },
  { value: 'international', label: 'International' },
]

function nextStep(current: number, isUnder18: boolean): number {
  if (current === 4 && !isUnder18) return 6
  return current + 1
}

function prevStep(current: number, isUnder18: boolean): number {
  if (current === 6 && !isUnder18) return 4
  return current - 1
}

function stepLabel(step: number): string {
  const labels: Record<number, string> = {
    1: 'Basic Info',
    2: 'Sport',
    3: 'Availability',
    4: 'Social & Bio',
    5: 'Guardian',
    6: 'Review & Publish',
  }
  return labels[step] ?? ''
}

// ─── Step 1 ──────────────────────────────────────────────────────────────────

function Step1({ profile, onSaved }: { profile: AthleteRow | null; onSaved: (p: AthleteRow) => void }) {
  const [loading, setLoading] = useState(false)
  const form = useForm<Step1Values>({
    resolver: zodResolver(step1Schema),
    defaultValues: {
      display_name: profile?.display_name ?? '',
      full_legal_name: profile?.full_legal_name ?? '',
      date_of_birth: profile?.date_of_birth ?? '',
      phone: profile?.phone ?? '',
      home_city: profile?.home_city ?? '',
      home_country: profile?.home_country ?? '',
    },
  })

  async function onSubmit(values: Step1Values) {
    setLoading(true)
    try {
      const method = profile ? 'PATCH' : 'POST'
      const res = await fetch('/api/profiles/me', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error?.message ?? 'Failed to save'); return }
      onSaved(data as AthleteRow)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField control={form.control} name="display_name" render={({ field }) => (
          <FormItem>
            <FormLabel>Display name</FormLabel>
            <FormControl><Input placeholder="How you appear on Podium" {...field} /></FormControl>
            <FormMessage />
          </FormItem>
        )} />
        <FormField control={form.control} name="full_legal_name" render={({ field }) => (
          <FormItem>
            <FormLabel>Full legal name <span className="text-muted-foreground text-xs">(private)</span></FormLabel>
            <FormControl><Input placeholder="For contracts" {...field} /></FormControl>
            <FormMessage />
          </FormItem>
        )} />
        <FormField control={form.control} name="date_of_birth" render={({ field }) => (
          <FormItem>
            <FormLabel>Date of birth <span className="text-muted-foreground text-xs">(private)</span></FormLabel>
            <FormControl><Input type="date" {...field} /></FormControl>
            <FormMessage />
          </FormItem>
        )} />
        <div className="grid grid-cols-2 gap-4">
          <FormField control={form.control} name="home_city" render={({ field }) => (
            <FormItem>
              <FormLabel>City</FormLabel>
              <FormControl><Input placeholder="London" {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )} />
          <FormField control={form.control} name="home_country" render={({ field }) => (
            <FormItem>
              <FormLabel>Country</FormLabel>
              <FormControl><Input placeholder="United Kingdom" {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )} />
        </div>
        <FormField control={form.control} name="phone" render={({ field }) => (
          <FormItem>
            <FormLabel>Phone <span className="text-muted-foreground text-xs">(private)</span></FormLabel>
            <FormControl><Input type="tel" placeholder="+44 7700 900000" {...field} /></FormControl>
            <FormMessage />
          </FormItem>
        )} />
        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? 'Saving…' : 'Next →'}
        </Button>
      </form>
    </Form>
  )
}

// ─── Step 2 ──────────────────────────────────────────────────────────────────

function Step2({ profile, onSaved }: { profile: AthleteRow | null; onSaved: (p: AthleteRow) => void }) {
  const [loading, setLoading] = useState(false)
  const form = useForm<Step2Values>({
    resolver: zodResolver(step2Schema),
    defaultValues: {
      primary_sport: profile?.primary_sport ?? '',
      secondary_sport: profile?.secondary_sport ?? '',
      level: (profile?.level as AthleteLevel | undefined) ?? undefined,
      position: profile?.position ?? '',
      years_active: profile?.years_active ?? undefined,
      height_cm: profile?.height_cm ?? undefined,
      weight_kg: profile?.weight_kg ?? undefined,
    },
  })

  async function onSubmit(values: Step2Values) {
    setLoading(true)
    try {
      const res = await fetch('/api/profiles/me', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error?.message ?? 'Failed to save'); return }
      onSaved(data as AthleteRow)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <FormField control={form.control} name="primary_sport" render={({ field }) => (
            <FormItem>
              <FormLabel>Primary sport</FormLabel>
              <FormControl><Input placeholder="Football" {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )} />
          <FormField control={form.control} name="secondary_sport" render={({ field }) => (
            <FormItem>
              <FormLabel>Secondary sport <span className="text-muted-foreground text-xs">(optional)</span></FormLabel>
              <FormControl><Input placeholder="Athletics" {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )} />
        </div>
        <FormField control={form.control} name="level" render={({ field }) => (
          <FormItem>
            <FormLabel>Level</FormLabel>
            <Select onValueChange={field.onChange} defaultValue={field.value}>
              <FormControl>
                <SelectTrigger><SelectValue placeholder="Select level" /></SelectTrigger>
              </FormControl>
              <SelectContent>
                {LEVEL_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <FormMessage />
          </FormItem>
        )} />
        <FormField control={form.control} name="position" render={({ field }) => (
          <FormItem>
            <FormLabel>Position / discipline</FormLabel>
            <FormControl><Input placeholder="Striker / Sprinter" {...field} /></FormControl>
            <FormMessage />
          </FormItem>
        )} />
        <div className="grid grid-cols-3 gap-4">
          <FormField control={form.control} name="years_active" render={({ field }) => (
            <FormItem>
              <FormLabel>Years active</FormLabel>
              <FormControl><Input type="number" min={0} max={50} {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )} />
          <FormField control={form.control} name="height_cm" render={({ field }) => (
            <FormItem>
              <FormLabel>Height (cm)</FormLabel>
              <FormControl><Input type="number" min={100} max={250} {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )} />
          <FormField control={form.control} name="weight_kg" render={({ field }) => (
            <FormItem>
              <FormLabel>Weight (kg)</FormLabel>
              <FormControl><Input type="number" min={30} max={200} {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )} />
        </div>
        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? 'Saving…' : 'Next →'}
        </Button>
      </form>
    </Form>
  )
}

// ─── Step 3 ──────────────────────────────────────────────────────────────────

function Step3({ profile, onSaved }: { profile: AthleteRow | null; onSaved: (p: AthleteRow) => void }) {
  const [loading, setLoading] = useState(false)
  const [seeking, setSeeking] = useState<string[]>(profile?.seeking ?? [])
  const form = useForm<Step3Values>({
    resolver: zodResolver(step3Schema),
    defaultValues: {
      availability_status: (profile?.availability_status as AvailabilityStatus | undefined) ?? undefined,
      available_from_date: profile?.available_from_date ?? '',
      travel_radius_km: profile?.travel_radius_km ?? undefined,
      seeking: profile?.seeking ?? [],
    },
  })

  function toggleSeeking(val: string) {
    setSeeking((prev) =>
      prev.includes(val) ? prev.filter((s) => s !== val) : [...prev, val]
    )
  }

  async function onSubmit(values: Step3Values) {
    setLoading(true)
    try {
      const res = await fetch('/api/profiles/me', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...values, seeking }),
      })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error?.message ?? 'Failed to save'); return }
      onSaved(data as AthleteRow)
    } finally {
      setLoading(false)
    }
  }

  const availStatus = form.watch('availability_status')

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField control={form.control} name="availability_status" render={({ field }) => (
          <FormItem>
            <FormLabel>Availability</FormLabel>
            <Select onValueChange={field.onChange} defaultValue={field.value}>
              <FormControl>
                <SelectTrigger><SelectValue placeholder="Select availability" /></SelectTrigger>
              </FormControl>
              <SelectContent>
                <SelectItem value="available_now">Available now</SelectItem>
                <SelectItem value="available_from">Available from a date</SelectItem>
                <SelectItem value="not_available">Not available</SelectItem>
              </SelectContent>
            </Select>
            <FormMessage />
          </FormItem>
        )} />
        {availStatus === 'available_from' && (
          <FormField control={form.control} name="available_from_date" render={({ field }) => (
            <FormItem>
              <FormLabel>Available from</FormLabel>
              <FormControl><Input type="date" {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )} />
        )}
        <FormField control={form.control} name="travel_radius_km" render={({ field }) => (
          <FormItem>
            <FormLabel>Travel radius (km)</FormLabel>
            <FormControl><Input type="number" min={0} max={20000} placeholder="50" {...field} /></FormControl>
            <FormMessage />
          </FormItem>
        )} />
        <div>
          <p className="mb-2 text-sm font-medium">I am seeking</p>
          <div className="flex flex-wrap gap-2">
            {SEEKING_OPTIONS.map((o) => (
              <button
                key={o.value}
                type="button"
                onClick={() => toggleSeeking(o.value)}
                className={cn(
                  'rounded-full border px-3 py-1 text-sm transition-colors',
                  seeking.includes(o.value)
                    ? 'border-foreground bg-foreground text-background'
                    : 'border-border hover:border-foreground/50'
                )}
              >
                {o.label}
              </button>
            ))}
          </div>
        </div>
        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? 'Saving…' : 'Next →'}
        </Button>
      </form>
    </Form>
  )
}

// ─── Step 4 ──────────────────────────────────────────────────────────────────

type SocialAccounts = { instagram?: string; tiktok?: string; youtube?: string; twitter?: string }

function Step4({ profile, onSaved }: { profile: AthleteRow | null; onSaved: (p: AthleteRow) => void }) {
  const [loading, setLoading] = useState(false)
  const social = (profile?.social_accounts ?? {}) as SocialAccounts
  const form = useForm<Step4Values>({
    resolver: zodResolver(step4Schema),
    defaultValues: {
      instagram: social.instagram ?? '',
      tiktok: social.tiktok ?? '',
      youtube: social.youtube ?? '',
      twitter: social.twitter ?? '',
      notable_achievements: profile?.notable_achievements ?? '',
    },
  })

  async function onSubmit({ instagram, tiktok, youtube, twitter, notable_achievements }: Step4Values) {
    setLoading(true)
    try {
      const social_accounts: SocialAccounts = {}
      if (instagram) social_accounts.instagram = instagram
      if (tiktok) social_accounts.tiktok = tiktok
      if (youtube) social_accounts.youtube = youtube
      if (twitter) social_accounts.twitter = twitter
      const res = await fetch('/api/profiles/me', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ social_accounts, notable_achievements }),
      })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error?.message ?? 'Failed to save'); return }
      onSaved(data as AthleteRow)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        {(['instagram', 'tiktok', 'youtube', 'twitter'] as const).map((platform) => (
          <FormField key={platform} control={form.control} name={platform} render={({ field }) => (
            <FormItem>
              <FormLabel className="capitalize">{platform} URL</FormLabel>
              <FormControl><Input type="url" placeholder={`https://${platform}.com/yourhandle`} {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )} />
        ))}
        <FormField control={form.control} name="notable_achievements" render={({ field }) => (
          <FormItem>
            <FormLabel>Notable achievements</FormLabel>
            <FormControl>
              <Textarea
                placeholder="County champion 2023, represented national youth team…"
                className="resize-none"
                rows={4}
                {...field}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )} />
        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? 'Saving…' : 'Next →'}
        </Button>
      </form>
    </Form>
  )
}

// ─── Step 5 (Guardian) ───────────────────────────────────────────────────────

function Step5({ profile, onSaved }: { profile: AthleteRow | null; onSaved: (p: AthleteRow) => void }) {
  const [loading, setLoading] = useState(false)

  if (!profile?.is_under_18) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">This step is not required for athletes 18 and over.</p>
        <Button type="button" className="w-full" onClick={() => onSaved(profile!)}>
          Next →
        </Button>
      </div>
    )
  }

  async function handleGuardianSave(values: GuardianValues) {
    setLoading(true)
    try {
      const res = await fetch('/api/profiles/me', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error?.message ?? 'Failed to save'); return }
      onSaved(data as AthleteRow)
    } finally {
      setLoading(false)
    }
  }

  return (
    <GuardianForm
      initialValues={{
        guardian_name: profile.guardian_name ?? '',
        guardian_relationship: profile.guardian_relationship ?? '',
        guardian_email: profile.guardian_email ?? '',
        guardian_phone: profile.guardian_phone ?? '',
      }}
      loading={loading}
      onSubmit={handleGuardianSave}
    />
  )
}

// ─── Step 6 (Review & Publish) ───────────────────────────────────────────────

function Step6({ profile }: { profile: AthleteRow | null }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  async function handlePublish() {
    setLoading(true)
    try {
      const res = await fetch('/api/profiles/me/publish', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error?.message ?? 'Failed to publish'); return }
      toast.success('Profile published!')
      router.push('/athlete/dashboard')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="rounded-xl border bg-muted/30 p-4 space-y-2">
        <p className="text-sm font-semibold">Profile summary</p>
        <dl className="space-y-1 text-sm">
          <div className="flex gap-2"><dt className="text-muted-foreground w-32">Display name</dt><dd>{profile?.display_name ?? '—'}</dd></div>
          <div className="flex gap-2"><dt className="text-muted-foreground w-32">Sport</dt><dd>{profile?.primary_sport ?? '—'}</dd></div>
          <div className="flex gap-2"><dt className="text-muted-foreground w-32">Level</dt><dd>{profile?.level ?? '—'}</dd></div>
          <div className="flex gap-2"><dt className="text-muted-foreground w-32">Location</dt><dd>{[profile?.home_city, profile?.home_country].filter(Boolean).join(', ') || '—'}</dd></div>
        </dl>
      </div>
      <p className="text-xs text-muted-foreground">
        Publishing makes your profile visible to brands and agents. You can edit it at any time from Settings.
      </p>
      <Button className="w-full" disabled={loading || !profile} onClick={handlePublish}>
        {loading ? 'Publishing…' : 'Publish profile'}
      </Button>
    </div>
  )
}

// ─── Main wizard orchestrator ─────────────────────────────────────────────────

export default function ProfileWizard({ step, profile: initialProfile }: Props) {
  const router = useRouter()
  const [profile, setProfile] = useState<AthleteRow | null>(initialProfile)

  const isUnder18 = profile?.is_under_18 ?? false

  function handleSaved(saved: AthleteRow) {
    setProfile(saved)
    const next = nextStep(step, saved.is_under_18)
    if (step === 6) return
    router.push(`/athlete/onboarding/step/${next}`)
  }

  function handleBack() {
    if (step <= 1) return
    const prev = prevStep(step, isUnder18)
    router.push(`/athlete/onboarding/step/${prev}`)
  }

  const TOTAL_STEPS = isUnder18 ? 6 : 5

  return (
    <div className="space-y-6">
      {/* Progress header */}
      <div>
        <div className="flex justify-between text-xs text-muted-foreground mb-1">
          <span>Step {step} of {TOTAL_STEPS} — {stepLabel(step)}</span>
          <span>{Math.round((step / TOTAL_STEPS) * 100)}%</span>
        </div>
        <div className="h-1.5 rounded-full bg-muted overflow-hidden">
          <div
            className="h-full bg-foreground transition-all"
            style={{ width: `${(step / TOTAL_STEPS) * 100}%` }}
          />
        </div>
      </div>

      {step === 1 && <Step1 profile={profile} onSaved={handleSaved} />}
      {step === 2 && <Step2 profile={profile} onSaved={handleSaved} />}
      {step === 3 && <Step3 profile={profile} onSaved={handleSaved} />}
      {step === 4 && <Step4 profile={profile} onSaved={handleSaved} />}
      {step === 5 && <Step5 profile={profile} onSaved={handleSaved} />}
      {step === 6 && <Step6 profile={profile} />}

      {step > 1 && (
        <Button variant="ghost" size="sm" className="w-full" onClick={handleBack}>
          ← Back
        </Button>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Run test — verify it passes**

```bash
npm run test -- profile-wizard
```

Expected: PASS (4 tests).

- [ ] **Step 5: Create onboarding page (redirects to step 1)**

```tsx
// app/(athlete)/athlete/onboarding/page.tsx
import { redirect } from 'next/navigation'

export default function OnboardingPage() {
  redirect('/athlete/onboarding/step/1')
}
```

- [ ] **Step 6: Create step page (server — fetches profile, renders wizard)**

```tsx
// app/(athlete)/athlete/onboarding/step/[step]/page.tsx
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getUser } from '@/lib/supabase/auth'
import { getOwnProfile } from '@/lib/supabase/profiles'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import ProfileWizard from '@/components/athlete/profile-wizard'
import type { Database } from '@/types/database'

type AthleteRow = Database['public']['Tables']['athlete_profiles']['Row']

const VALID_STEPS = [1, 2, 3, 4, 5, 6]

export default async function OnboardingStepPage({
  params,
}: {
  params: Promise<{ step: string }>
}) {
  const { step: stepParam } = await params
  const step = Number(stepParam)
  if (!VALID_STEPS.includes(step)) redirect('/athlete/onboarding/step/1')

  const supabase = await createClient()
  const user = await getUser(supabase)
  if (!user) redirect('/auth')

  const profile = await getOwnProfile(supabase, user.id, 'athlete') as AthleteRow | null

  if (profile?.status === 'active') redirect('/athlete/dashboard')

  const STEP_TITLES: Record<number, string> = {
    1: 'Basic info',
    2: 'Your sport',
    3: 'Availability',
    4: 'Social & bio',
    5: 'Guardian details',
    6: 'Review & publish',
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-xl">
        <CardHeader>
          <CardTitle>Set up your profile — {STEP_TITLES[step]}</CardTitle>
        </CardHeader>
        <CardContent>
          <ProfileWizard step={step} profile={profile} />
        </CardContent>
      </Card>
    </div>
  )
}
```

- [ ] **Step 7: Type-check**

```bash
npm run type-check
```

Expected: no errors.

- [ ] **Step 8: Commit**

```bash
git add "app/(athlete)/athlete/onboarding/page.tsx" "app/(athlete)/athlete/onboarding/step/[step]/page.tsx" components/athlete/profile-wizard.tsx components/athlete/profile-wizard.test.tsx
git commit -m "feat(athlete): 6-step onboarding wizard with profile create/update"
```

---

## Task 5: Guardian form + profile preview + publish endpoint

**Files:**
- Create: `components/athlete/guardian-form.tsx`
- Create: `app/api/profiles/me/publish/route.ts`
- Create: `app/(athlete)/athlete/onboarding/preview/page.tsx`
- Create: `components/athlete/profile-preview.tsx`

- [ ] **Step 1: Create guardian form**

```tsx
// components/athlete/guardian-form.tsx
'use client'

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'

const guardianSchema = z.object({
  guardian_name: z.string().min(1, 'Guardian name is required'),
  guardian_relationship: z.string().min(1, 'Relationship is required'),
  guardian_email: z.string().email('Valid email required'),
  guardian_phone: z.string().min(7, 'Phone number required'),
})

export type GuardianValues = z.infer<typeof guardianSchema>

interface Props {
  initialValues: GuardianValues
  loading: boolean
  onSubmit: (values: GuardianValues) => void
}

export default function GuardianForm({ initialValues, loading, onSubmit }: Props) {
  const form = useForm<GuardianValues>({
    resolver: zodResolver(guardianSchema),
    defaultValues: initialValues,
  })

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Because you are under 18, a parent or guardian must be registered for contract and payment purposes.
        </p>
        <FormField control={form.control} name="guardian_name" render={({ field }) => (
          <FormItem>
            <FormLabel>Guardian full name</FormLabel>
            <FormControl><Input placeholder="Jane Smith" {...field} /></FormControl>
            <FormMessage />
          </FormItem>
        )} />
        <FormField control={form.control} name="guardian_relationship" render={({ field }) => (
          <FormItem>
            <FormLabel>Relationship</FormLabel>
            <FormControl><Input placeholder="Parent / Legal guardian" {...field} /></FormControl>
            <FormMessage />
          </FormItem>
        )} />
        <FormField control={form.control} name="guardian_email" render={({ field }) => (
          <FormItem>
            <FormLabel>Guardian email</FormLabel>
            <FormControl><Input type="email" {...field} /></FormControl>
            <FormMessage />
          </FormItem>
        )} />
        <FormField control={form.control} name="guardian_phone" render={({ field }) => (
          <FormItem>
            <FormLabel>Guardian phone</FormLabel>
            <FormControl><Input type="tel" {...field} /></FormControl>
            <FormMessage />
          </FormItem>
        )} />
        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? 'Saving…' : 'Next →'}
        </Button>
      </form>
    </Form>
  )
}
```

- [ ] **Step 2: Create publish API route**

```ts
// app/api/profiles/me/publish/route.ts
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getUser } from '@/lib/supabase/auth'
import { publishProfile, ProfileError, type ProfileRole } from '@/lib/supabase/profiles'

const PROFILE_ROLES = new Set<string>(['athlete', 'team', 'agent'])

export async function POST() {
  const supabase = await createClient()
  const user = await getUser(supabase)

  if (!user) {
    return NextResponse.json(
      { error: { code: 'UNAUTHENTICATED', message: 'Authentication required' } },
      { status: 401 }
    )
  }

  if (!user.role || !PROFILE_ROLES.has(user.role)) {
    return NextResponse.json(
      { error: { code: 'FORBIDDEN', message: 'Only athletes, teams and agents can publish' } },
      { status: 403 }
    )
  }

  try {
    await publishProfile(supabase, user.id, user.role as ProfileRole)
    return NextResponse.json({ message: 'Profile published' })
  } catch (err) {
    if (err instanceof ProfileError) {
      if (err.code === 'PROFILE_NOT_FOUND') {
        return NextResponse.json(
          { error: { code: 'PROFILE_NOT_FOUND', message: err.message } },
          { status: 404 }
        )
      }
    }
    throw err
  }
}
```

- [ ] **Step 3: Create profile preview component**

```tsx
// components/athlete/profile-preview.tsx
import type { Database } from '@/types/database'

type AthleteRow = Database['public']['Tables']['athlete_profiles']['Row']
type SocialAccounts = { instagram?: string; tiktok?: string; youtube?: string; twitter?: string }

interface Props { profile: AthleteRow }

export default function ProfilePreview({ profile }: Props) {
  const social = (profile.social_accounts ?? {}) as SocialAccounts

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-4">
        <div className="flex size-16 items-center justify-center rounded-full bg-muted text-2xl font-bold">
          {(profile.display_name ?? '?')[0].toUpperCase()}
        </div>
        <div>
          <h2 className="text-xl font-bold">{profile.display_name}</h2>
          <p className="text-muted-foreground text-sm">
            {[profile.primary_sport, profile.level?.replace('_', ' ')].filter(Boolean).join(' · ')}
          </p>
          <p className="text-muted-foreground text-sm">
            {[profile.home_city, profile.home_country].filter(Boolean).join(', ')}
          </p>
        </div>
      </div>

      {profile.notable_achievements && (
        <div>
          <h3 className="text-sm font-semibold mb-1">Achievements</h3>
          <p className="text-sm text-muted-foreground">{profile.notable_achievements}</p>
        </div>
      )}

      {(social.instagram || social.tiktok || social.youtube || social.twitter) && (
        <div>
          <h3 className="text-sm font-semibold mb-2">Social</h3>
          <div className="flex flex-wrap gap-2">
            {social.instagram && <a href={social.instagram} target="_blank" rel="noopener noreferrer" className="text-xs underline">Instagram</a>}
            {social.tiktok && <a href={social.tiktok} target="_blank" rel="noopener noreferrer" className="text-xs underline">TikTok</a>}
            {social.youtube && <a href={social.youtube} target="_blank" rel="noopener noreferrer" className="text-xs underline">YouTube</a>}
            {social.twitter && <a href={social.twitter} target="_blank" rel="noopener noreferrer" className="text-xs underline">X / Twitter</a>}
          </div>
        </div>
      )}

      {profile.seeking.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold mb-2">Seeking</h3>
          <div className="flex flex-wrap gap-2">
            {profile.seeking.map((s) => (
              <span key={s} className="rounded-full bg-muted px-3 py-1 text-xs">{s.replace('_', ' ')}</span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Create preview page**

```tsx
// app/(athlete)/athlete/onboarding/preview/page.tsx
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getUser } from '@/lib/supabase/auth'
import { getOwnProfile } from '@/lib/supabase/profiles'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { buttonVariants } from '@/components/ui/button'
import ProfilePreview from '@/components/athlete/profile-preview'
import type { Database } from '@/types/database'

type AthleteRow = Database['public']['Tables']['athlete_profiles']['Row']

export default async function OnboardingPreviewPage() {
  const supabase = await createClient()
  const user = await getUser(supabase)
  if (!user) redirect('/auth')

  const profile = await getOwnProfile(supabase, user.id, 'athlete') as AthleteRow | null
  if (!profile) redirect('/athlete/onboarding/step/1')

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-xl">
        <CardHeader>
          <CardTitle>Profile preview</CardTitle>
          <CardDescription>This is how brands and agents will see your profile.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <ProfilePreview profile={profile} />
          <div className="flex gap-3">
            <Link
              href="/athlete/onboarding/step/6"
              className={buttonVariants({ variant: 'outline' })}
            >
              ← Edit
            </Link>
            <Link
              href="/athlete/dashboard"
              className={buttonVariants()}
            >
              Go to dashboard
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
```

- [ ] **Step 5: Type-check**

```bash
npm run type-check
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add components/athlete/guardian-form.tsx app/api/profiles/me/publish/route.ts "app/(athlete)/athlete/onboarding/preview/page.tsx" components/athlete/profile-preview.tsx
git commit -m "feat(athlete): guardian form, publish endpoint, profile preview"
```

---

## Task 6: Athlete dashboard page

**Files:**
- Create: `app/(athlete)/athlete/dashboard/page.tsx`

- [ ] **Step 1: Create dashboard page**

```tsx
// app/(athlete)/athlete/dashboard/page.tsx
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getUser } from '@/lib/supabase/auth'
import { getOwnProfile } from '@/lib/supabase/profiles'
import { getMatches } from '@/lib/supabase/messaging'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { Database } from '@/types/database'

type AthleteRow = Database['public']['Tables']['athlete_profiles']['Row']
type MatchRow = Database['public']['Tables']['matches']['Row']

export default async function AthleteDashboardPage() {
  const supabase = await createClient()
  const user = await getUser(supabase)
  if (!user) redirect('/auth')

  const [profile, matches] = await Promise.all([
    getOwnProfile(supabase, user.id, 'athlete') as Promise<AthleteRow | null>,
    getMatches(supabase, user.id) as Promise<MatchRow[]>,
  ])

  if (!profile) redirect('/athlete/onboarding')
  if (profile.status === 'draft') redirect('/athlete/onboarding/step/1')

  const activeMatches = matches.filter((m) => m.status === 'active')

  return (
    <div className="mx-auto max-w-5xl space-y-8 px-4 py-8">
      <div>
        <h1 className="text-2xl font-bold">Welcome back, {profile.display_name}</h1>
        <p className="text-muted-foreground">
          {profile.status === 'pending_review'
            ? 'Your profile is under review. We will notify you when it goes live.'
            : 'Your profile is live.'}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Active conversations</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{activeMatches.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Sport</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-lg font-semibold">{profile.primary_sport ?? '—'}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Profile status</CardTitle>
          </CardHeader>
          <CardContent>
            <span className={cn(
              'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
              profile.status === 'active' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
            )}>
              {profile.status.replace('_', ' ')}
            </span>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-wrap gap-3">
        <Link href="/athlete/discover" className={buttonVariants()}>Browse brands</Link>
        <Link href="/athlete/messages" className={buttonVariants({ variant: 'outline' })}>Messages ({activeMatches.length})</Link>
        <Link href="/athlete/requests" className={buttonVariants({ variant: 'outline' })}>Connection requests</Link>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add "app/(athlete)/athlete/dashboard/page.tsx"
git commit -m "feat(athlete): dashboard page with stats and quick links"
```

---

## Task 7: Discovery — listing card + listings grid + discover page

**Files:**
- Create: `components/discovery/listing-card.tsx`
- Create: `components/discovery/listings-grid.tsx`
- Create: `components/discovery/listings-grid.test.tsx`
- Create: `app/(athlete)/athlete/discover/page.tsx`

- [ ] **Step 1: Write failing test**

```tsx
// components/discovery/listings-grid.test.tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect } from 'vitest'
import ListingsGrid from './listings-grid'
import type { Database } from '@/types/database'

type JobListingRow = Database['public']['Tables']['job_listings']['Row']

const makelisting = (overrides: Partial<JobListingRow>): JobListingRow => ({
  id: 'l1',
  brand_id: 'b1',
  title: 'Football Endorsement',
  type: 'athlete_endorsement',
  description: 'Looking for a footballer',
  sport_required: 'Football',
  level_required: 'semi_professional',
  location: 'London',
  is_remote: false,
  pay_type: 'flat_fee',
  pay_amount: 5000,
  pay_currency: 'GBP',
  deliverables: [],
  exclusivity_required: false,
  contract_duration_months: 6,
  status: 'active',
  application_deadline: null,
  max_hires: null,
  multiple_hires: false,
  number_of_teams_sought: null,
  sponsorship_structure: null,
  total_sponsorship_budget: null,
  usage_rights: null,
  what_expected: null,
  created_at: '2024-01-01',
  updated_at: '2024-01-01',
  ...overrides,
})

describe('ListingsGrid', () => {
  it('renders all listing titles', () => {
    const listings = [makelisting({ id: 'l1', title: 'Football Deal' }), makelisting({ id: 'l2', title: 'Tennis Deal', sport_required: 'Tennis' })]
    render(<ListingsGrid listings={listings} />)
    expect(screen.getByText('Football Deal')).toBeInTheDocument()
    expect(screen.getByText('Tennis Deal')).toBeInTheDocument()
  })

  it('filters listings by sport search', async () => {
    const listings = [makelisting({ id: 'l1', title: 'Football Deal', sport_required: 'Football' }), makelisting({ id: 'l2', title: 'Tennis Deal', sport_required: 'Tennis' })]
    render(<ListingsGrid listings={listings} />)
    await userEvent.type(screen.getByPlaceholderText(/search/i), 'Tennis')
    expect(screen.queryByText('Football Deal')).toBeNull()
    expect(screen.getByText('Tennis Deal')).toBeInTheDocument()
  })

  it('shows empty state when no listings match', async () => {
    render(<ListingsGrid listings={[makelisting({ id: 'l1', sport_required: 'Football' })]} />)
    await userEvent.type(screen.getByPlaceholderText(/search/i), 'Archery')
    expect(screen.getByText(/no listings/i)).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test — verify it fails**

```bash
npm run test -- listings-grid
```

Expected: FAIL — `ListingsGrid` not found.

- [ ] **Step 3: Create listing card**

```tsx
// components/discovery/listing-card.tsx
import type { Database } from '@/types/database'

type JobListingRow = Database['public']['Tables']['job_listings']['Row']

interface Props { listing: JobListingRow }

const PAY_TYPE_LABEL: Record<string, string> = {
  flat_fee: 'Flat fee',
  monthly_retainer: 'Monthly retainer',
  per_post: 'Per post',
  revenue_share: 'Revenue share',
}

export default function ListingCard({ listing }: Props) {
  const payLabel = listing.pay_type ? PAY_TYPE_LABEL[listing.pay_type] : null

  return (
    <div className="rounded-xl border bg-card p-5 shadow-sm space-y-3 hover:shadow-md transition-shadow">
      <div>
        <p className="font-semibold">{listing.title}</p>
        <p className="text-xs text-muted-foreground mt-0.5">
          {[listing.sport_required, listing.level_required?.replace('_', ' ')].filter(Boolean).join(' · ')}
        </p>
      </div>
      {listing.description && (
        <p className="text-sm text-muted-foreground line-clamp-2">{listing.description}</p>
      )}
      <div className="flex flex-wrap gap-2">
        {listing.location && (
          <span className="rounded-full bg-muted px-2 py-0.5 text-xs">{listing.is_remote ? 'Remote' : listing.location}</span>
        )}
        {payLabel && listing.pay_amount && (
          <span className="rounded-full bg-muted px-2 py-0.5 text-xs">
            {payLabel} · {listing.pay_currency} {listing.pay_amount.toLocaleString()}
          </span>
        )}
        {listing.contract_duration_months && (
          <span className="rounded-full bg-muted px-2 py-0.5 text-xs">{listing.contract_duration_months}mo contract</span>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Create listings grid**

```tsx
// components/discovery/listings-grid.tsx
'use client'

import { useState } from 'react'
import { Input } from '@/components/ui/input'
import ListingCard from './listing-card'
import type { Database } from '@/types/database'

type JobListingRow = Database['public']['Tables']['job_listings']['Row']

interface Props { listings: JobListingRow[] }

export default function ListingsGrid({ listings }: Props) {
  const [search, setSearch] = useState('')

  const filtered = listings.filter((l) => {
    if (!search) return true
    const q = search.toLowerCase()
    return (
      l.title.toLowerCase().includes(q) ||
      l.sport_required?.toLowerCase().includes(q) ||
      l.description?.toLowerCase().includes(q) ||
      l.location?.toLowerCase().includes(q)
    )
  })

  return (
    <div className="space-y-4">
      <Input
        placeholder="Search by sport, title, location…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="max-w-sm"
      />
      {filtered.length === 0 ? (
        <p className="text-center text-muted-foreground py-12">No listings match your search.</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((l) => <ListingCard key={l.id} listing={l} />)}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 5: Create discover page**

```tsx
// app/(athlete)/athlete/discover/page.tsx
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getUser } from '@/lib/supabase/auth'
import { getListings } from '@/lib/supabase/discovery'
import ListingsGrid from '@/components/discovery/listings-grid'

export default async function AthleteDiscoverPage() {
  const supabase = await createClient()
  const user = await getUser(supabase)
  if (!user) redirect('/auth')

  const listings = await getListings(supabase)
  const active = listings.filter((l) => l.status === 'active')

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Discover opportunities</h1>
        <p className="text-muted-foreground">{active.length} brand campaigns available</p>
      </div>
      <ListingsGrid listings={active} />
    </div>
  )
}
```

- [ ] **Step 6: Run tests — verify they pass**

```bash
npm run test -- listings-grid
```

Expected: PASS (3 tests).

- [ ] **Step 7: Commit**

```bash
git add components/discovery/listing-card.tsx components/discovery/listings-grid.tsx components/discovery/listings-grid.test.tsx "app/(athlete)/athlete/discover/page.tsx"
git commit -m "feat(athlete): listing card, filterable grid, discover page"
```

---

## Task 8: Saved page + connection request card + requests page

**Files:**
- Create: `app/(athlete)/athlete/saved/page.tsx`
- Create: `components/discovery/connection-request-card.tsx`
- Create: `components/discovery/connection-request-card.test.tsx`
- Create: `app/(athlete)/athlete/requests/page.tsx`

- [ ] **Step 1: Write failing test**

```tsx
// components/discovery/connection-request-card.test.tsx
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import ConnectionRequestCard from './connection-request-card'
import type { Database } from '@/types/database'

type ConnectionRequestRow = Database['public']['Tables']['connection_requests']['Row']

const makeRequest = (): ConnectionRequestRow => ({
  id: 'req1',
  sender_id: 'brand1',
  recipient_id: 'athlete1',
  message: 'We would love to work with you!',
  status: 'pending',
  sent_at: '2024-01-01T00:00:00Z',
  responded_at: null,
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
})

describe('ConnectionRequestCard', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })

  it('renders sender id and message', () => {
    render(<ConnectionRequestCard request={makeRequest()} onResponded={vi.fn()} />)
    expect(screen.getByText(/we would love to work with you/i)).toBeInTheDocument()
  })

  it('calls PATCH /api/discovery/connections/[id] with accepted on Accept', async () => {
    vi.mocked(fetch).mockResolvedValue({ ok: true, json: async () => ({}) } as Response)
    const onResponded = vi.fn()
    render(<ConnectionRequestCard request={makeRequest()} onResponded={onResponded} />)
    await userEvent.click(screen.getByRole('button', { name: /accept/i }))
    await waitFor(() =>
      expect(fetch).toHaveBeenCalledWith(
        '/api/discovery/connections/req1',
        expect.objectContaining({ method: 'PATCH', body: JSON.stringify({ action: 'accepted' }) })
      )
    )
    expect(onResponded).toHaveBeenCalled()
  })

  it('calls PATCH with declined on Decline', async () => {
    vi.mocked(fetch).mockResolvedValue({ ok: true, json: async () => ({}) } as Response)
    const onResponded = vi.fn()
    render(<ConnectionRequestCard request={makeRequest()} onResponded={onResponded} />)
    await userEvent.click(screen.getByRole('button', { name: /decline/i }))
    await waitFor(() =>
      expect(fetch).toHaveBeenCalledWith(
        '/api/discovery/connections/req1',
        expect.objectContaining({ method: 'PATCH', body: JSON.stringify({ action: 'declined' }) })
      )
    )
  })
})
```

- [ ] **Step 2: Run test — verify it fails**

```bash
npm run test -- connection-request-card
```

Expected: FAIL.

- [ ] **Step 3: Create connection request card**

```tsx
// components/discovery/connection-request-card.tsx
'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import type { Database } from '@/types/database'

type ConnectionRequestRow = Database['public']['Tables']['connection_requests']['Row']

interface Props {
  request: ConnectionRequestRow
  onResponded: () => void
}

export default function ConnectionRequestCard({ request, onResponded }: Props) {
  const [loading, setLoading] = useState<'accepted' | 'declined' | null>(null)

  async function respond(action: 'accepted' | 'declined') {
    setLoading(action)
    try {
      const res = await fetch(`/api/discovery/connections/${request.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error?.message ?? 'Failed'); return }
      toast.success(action === 'accepted' ? 'Request accepted — you can now message them' : 'Request declined')
      onResponded()
    } finally {
      setLoading(null)
    }
  }

  return (
    <div className="rounded-xl border bg-card p-5 space-y-3">
      <div>
        <p className="text-xs text-muted-foreground">Connection request from brand</p>
        <p className="text-sm font-mono text-muted-foreground">{request.sender_id}</p>
      </div>
      <blockquote className="border-l-2 pl-3 text-sm text-muted-foreground italic">
        {request.message}
      </blockquote>
      <p className="text-xs text-muted-foreground">
        Received {new Date(request.sent_at).toLocaleDateString()}
      </p>
      <div className="flex gap-2">
        <Button
          size="sm"
          onClick={() => respond('accepted')}
          disabled={loading !== null}
        >
          {loading === 'accepted' ? 'Accepting…' : 'Accept'}
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => respond('declined')}
          disabled={loading !== null}
        >
          {loading === 'declined' ? 'Declining…' : 'Decline'}
        </Button>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Create saved page**

```tsx
// app/(athlete)/athlete/saved/page.tsx
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getUser } from '@/lib/supabase/auth'
import { getShortlist } from '@/lib/supabase/discovery'
import { getPublicProfile } from '@/lib/supabase/profiles'
import type { Database } from '@/types/database'

type BrandRow = Database['public']['Tables']['brand_profiles']['Row']

export default async function AthleteSavedPage() {
  const supabase = await createClient()
  const user = await getUser(supabase)
  if (!user) redirect('/auth')

  const shortlist = await getShortlist(supabase, user.id)

  const profiles = await Promise.all(
    shortlist.map((item) => getPublicProfile(supabase, item.target_user_id, 'brand'))
  )
  const brands = profiles.filter(Boolean) as BrandRow[]

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Saved brands</h1>
        <p className="text-muted-foreground">{brands.length} saved</p>
      </div>
      {brands.length === 0 ? (
        <p className="text-center text-muted-foreground py-12">
          No saved brands yet. Browse <a href="/athlete/discover" className="underline">opportunities</a> to find brands you like.
        </p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {brands.map((brand) => (
            <div key={brand.id} className="rounded-xl border bg-card p-5">
              <p className="font-semibold">{(brand as { company_name?: string }).company_name ?? brand.id}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 5: Create requests page**

The `connection_requests` table has no dedicated GET API route. This page queries directly via the Supabase server client. This is documented as technical debt — a `GET /api/discovery/connections/incoming` endpoint should be added in a future phase.

```tsx
// app/(athlete)/athlete/requests/page.tsx
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getUser } from '@/lib/supabase/auth'
import RequestsList from '@/components/discovery/requests-list'
import type { Database } from '@/types/database'
import type { SupabaseClient } from '@supabase/supabase-js'

type ConnectionRequestRow = Database['public']['Tables']['connection_requests']['Row']

export default async function AthleteRequestsPage() {
  const supabase = await createClient()
  const user = await getUser(supabase)
  if (!user) redirect('/auth')

  // Tech debt: no lib/supabase wrapper for incoming connection requests.
  // Direct query here until GET /api/discovery/connections/incoming is added.
  const { data } = await (supabase as SupabaseClient)
    .from('connection_requests')
    .select('*')
    .eq('recipient_id', user.id)
    .eq('status', 'pending')
    .order('sent_at', { ascending: false })

  const requests = (data ?? []) as ConnectionRequestRow[]

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Connection requests</h1>
        <p className="text-muted-foreground">{requests.length} pending</p>
      </div>
      <RequestsList requests={requests} />
    </div>
  )
}
```

- [ ] **Step 6: Create requests list client component**

The requests page is a server component but needs a client child to handle the respond interaction and optimistically remove accepted/declined cards.

```tsx
// components/discovery/requests-list.tsx
'use client'

import { useState } from 'react'
import ConnectionRequestCard from './connection-request-card'
import type { Database } from '@/types/database'

type ConnectionRequestRow = Database['public']['Tables']['connection_requests']['Row']

interface Props { requests: ConnectionRequestRow[] }

export default function RequestsList({ requests: initial }: Props) {
  const [requests, setRequests] = useState(initial)

  function handleResponded(id: string) {
    setRequests((prev) => prev.filter((r) => r.id !== id))
  }

  if (requests.length === 0) {
    return <p className="text-center text-muted-foreground py-12">No pending connection requests.</p>
  }

  return (
    <div className="space-y-4">
      {requests.map((req) => (
        <ConnectionRequestCard
          key={req.id}
          request={req}
          onResponded={() => handleResponded(req.id)}
        />
      ))}
    </div>
  )
}
```

- [ ] **Step 7: Run tests — verify they pass**

```bash
npm run test -- connection-request-card
```

Expected: PASS (3 tests).

- [ ] **Step 8: Type-check**

```bash
npm run type-check
```

Expected: no errors.

- [ ] **Step 9: Commit**

```bash
git add "app/(athlete)/athlete/saved/page.tsx" components/discovery/connection-request-card.tsx components/discovery/connection-request-card.test.tsx "app/(athlete)/athlete/requests/page.tsx" components/discovery/requests-list.tsx
git commit -m "feat(athlete): saved page, connection request card + requests page"
```

---

## Task 9: Messages — match list + messages index page

**Files:**
- Create: `components/messaging/match-list.tsx`
- Create: `app/(athlete)/athlete/messages/page.tsx`

- [ ] **Step 1: Create match list component**

```tsx
// components/messaging/match-list.tsx
import Link from 'next/link'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { Database } from '@/types/database'

type MatchRow = Database['public']['Tables']['matches']['Row']

interface Props {
  matches: MatchRow[]
  currentUserId: string
  basePath: string
}

export default function MatchList({ matches, currentUserId, basePath }: Props) {
  if (matches.length === 0) {
    return (
      <p className="text-center text-muted-foreground py-12">
        No conversations yet. Accept a connection request to start chatting.
      </p>
    )
  }

  return (
    <ul className="divide-y rounded-xl border">
      {matches.map((match) => {
        const otherId = match.user_a_id === currentUserId ? match.user_b_id : match.user_a_id
        return (
          <li key={match.id}>
            <Link
              href={`${basePath}/${match.id}`}
              className={cn(
                'flex items-center justify-between px-4 py-3 hover:bg-muted/50 transition-colors'
              )}
            >
              <div>
                <p className="font-medium text-sm">Conversation</p>
                <p className="text-xs text-muted-foreground font-mono">{otherId}</p>
              </div>
              <span className="text-xs text-muted-foreground">
                {new Date(match.matched_at).toLocaleDateString()}
              </span>
            </Link>
          </li>
        )
      })}
    </ul>
  )
}
```

- [ ] **Step 2: Create messages index page**

```tsx
// app/(athlete)/athlete/messages/page.tsx
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getUser } from '@/lib/supabase/auth'
import { getMatches } from '@/lib/supabase/messaging'
import MatchList from '@/components/messaging/match-list'
import type { Database } from '@/types/database'

type MatchRow = Database['public']['Tables']['matches']['Row']

export default async function AthleteMessagesPage() {
  const supabase = await createClient()
  const user = await getUser(supabase)
  if (!user) redirect('/auth')

  const matches = (await getMatches(supabase, user.id)) as MatchRow[]
  const active = matches.filter((m) => m.status === 'active')

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 space-y-6">
      <h1 className="text-2xl font-bold">Messages</h1>
      <MatchList matches={active} currentUserId={user.id} basePath="/athlete/messages" />
    </div>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add components/messaging/match-list.tsx "app/(athlete)/athlete/messages/page.tsx"
git commit -m "feat(athlete): messages index with match list"
```

---

## Task 10: Chat — bubble + proposal card + chat window + chat page

**Files:**
- Create: `components/messaging/message-bubble.tsx`
- Create: `components/messaging/proposal-card-message.tsx`
- Create: `components/messaging/chat-window.tsx`
- Create: `app/(athlete)/athlete/messages/[matchId]/page.tsx`

- [ ] **Step 1: Create message bubble**

```tsx
// components/messaging/message-bubble.tsx
import { cn } from '@/lib/utils'
import type { Database } from '@/types/database'

type MessageRow = Database['public']['Tables']['messages']['Row']

interface Props {
  message: MessageRow
  isMine: boolean
}

export default function MessageBubble({ message, isMine }: Props) {
  if (message.is_deleted) {
    return (
      <div className={cn('flex', isMine ? 'justify-end' : 'justify-start')}>
        <p className="text-xs text-muted-foreground italic px-3 py-1">Message deleted</p>
      </div>
    )
  }

  if (message.content_type !== 'text') {
    return null
  }

  return (
    <div className={cn('flex', isMine ? 'justify-end' : 'justify-start')}>
      <div
        className={cn(
          'max-w-xs rounded-2xl px-4 py-2 text-sm',
          isMine
            ? 'bg-foreground text-background rounded-br-sm'
            : 'bg-muted text-foreground rounded-bl-sm'
        )}
      >
        {message.text_content}
        <p className={cn('text-xs mt-1', isMine ? 'text-background/60' : 'text-muted-foreground')}>
          {new Date(message.sent_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </p>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Create proposal card message**

```tsx
// components/messaging/proposal-card-message.tsx
'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import type { Database } from '@/types/database'

type ProposalRow = Database['public']['Tables']['proposals']['Row']

interface Props {
  proposal: ProposalRow
  isMine: boolean
  onResponded: () => void
}

const PAY_TYPE_LABEL: Record<string, string> = {
  flat_fee: 'Flat fee',
  monthly_retainer: 'Monthly retainer',
  per_post: 'Per post',
  revenue_share: 'Revenue share',
}

export default function ProposalCardMessage({ proposal, isMine, onResponded }: Props) {
  const [loading, setLoading] = useState<'accepted' | 'declined' | null>(null)

  async function respond(action: 'accepted' | 'declined') {
    setLoading(action)
    try {
      const res = await fetch(`/api/deals/proposals/${proposal.id}/respond`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error?.message ?? 'Failed'); return }
      toast.success(action === 'accepted' ? 'Proposal accepted!' : 'Proposal declined')
      onResponded()
    } finally {
      setLoading(null)
    }
  }

  return (
    <div className="rounded-xl border bg-card p-4 space-y-3 max-w-sm">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">Proposal</p>
        <span className={cn(
          'text-xs rounded-full px-2 py-0.5 font-medium',
          proposal.status === 'pending' ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' :
          proposal.status === 'accepted' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
          'bg-muted text-muted-foreground'
        )}>
          {proposal.status}
        </span>
      </div>
      <p className="font-semibold">{proposal.title}</p>
      <dl className="space-y-1 text-sm">
        <div className="flex gap-2">
          <dt className="text-muted-foreground w-20">Amount</dt>
          <dd>{proposal.pay_currency} {proposal.pay_amount.toLocaleString()}</dd>
        </div>
        <div className="flex gap-2">
          <dt className="text-muted-foreground w-20">Type</dt>
          <dd>{PAY_TYPE_LABEL[proposal.pay_type] ?? proposal.pay_type}</dd>
        </div>
        {proposal.timeline_start && (
          <div className="flex gap-2">
            <dt className="text-muted-foreground w-20">Start</dt>
            <dd>{new Date(proposal.timeline_start).toLocaleDateString()}</dd>
          </div>
        )}
      </dl>
      {!isMine && proposal.status === 'pending' && (
        <div className="flex gap-2 pt-1">
          <Button size="sm" onClick={() => respond('accepted')} disabled={loading !== null}>
            {loading === 'accepted' ? 'Accepting…' : 'Accept'}
          </Button>
          <Button variant="outline" size="sm" onClick={() => respond('declined')} disabled={loading !== null}>
            {loading === 'declined' ? 'Declining…' : 'Decline'}
          </Button>
        </div>
      )}
    </div>
  )
}

function cn(...classes: (string | boolean | undefined)[]) {
  return classes.filter(Boolean).join(' ')
}
```

- [ ] **Step 3: Create chat window**

```tsx
// components/messaging/chat-window.tsx
'use client'

import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { createClient } from '@/lib/supabase/client'
import MessageBubble from './message-bubble'
import ProposalCardMessage from './proposal-card-message'
import type { Database } from '@/types/database'

type MessageRow = Database['public']['Tables']['messages']['Row']
type ProposalRow = Database['public']['Tables']['proposals']['Row']

interface Props {
  matchId: string
  initialMessages: MessageRow[]
  proposals: ProposalRow[]
  currentUserId: string
}

export default function ChatWindow({ matchId, initialMessages, proposals, currentUserId }: Props) {
  const [messages, setMessages] = useState<MessageRow[]>(initialMessages)
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  const proposalMap = new Map(proposals.map((p) => [p.id, p]))

  useEffect(() => {
    const supabase = createClient()
    const channel = supabase
      .channel(`match:${matchId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `match_id=eq.${matchId}` },
        (payload) => {
          const msg = payload.new as MessageRow
          setMessages((prev) => {
            if (prev.some((m) => m.id === msg.id)) return prev
            return [...prev, msg]
          })
        }
      )
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [matchId])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function sendText(e: React.FormEvent) {
    e.preventDefault()
    if (!text.trim()) return
    setSending(true)
    try {
      const res = await fetch(`/api/messaging/matches/${matchId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content_type: 'text', text_content: text.trim() }),
      })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error?.message ?? 'Failed to send'); return }
      setText('')
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)]">
      <div className="flex-1 overflow-y-auto space-y-3 p-4">
        {messages.map((msg) => {
          if (msg.content_type === 'proposal_card') {
            const proposalId = (msg.metadata as { proposal_id?: string })?.proposal_id
            const proposal = proposalId ? proposalMap.get(proposalId) : undefined
            if (proposal) {
              return (
                <div key={msg.id} className={`flex ${msg.sender_id === currentUserId ? 'justify-end' : 'justify-start'}`}>
                  <ProposalCardMessage
                    proposal={proposal}
                    isMine={msg.sender_id === currentUserId}
                    onResponded={() => {}}
                  />
                </div>
              )
            }
            return null
          }
          return (
            <MessageBubble
              key={msg.id}
              message={msg}
              isMine={msg.sender_id === currentUserId}
            />
          )
        })}
        <div ref={bottomRef} />
      </div>
      <form onSubmit={sendText} className="border-t p-3 flex gap-2">
        <Input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Type a message…"
          disabled={sending}
          className="flex-1"
        />
        <Button type="submit" disabled={sending || !text.trim()}>Send</Button>
      </form>
    </div>
  )
}
```

- [ ] **Step 4: Create chat page**

```tsx
// app/(athlete)/athlete/messages/[matchId]/page.tsx
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getUser } from '@/lib/supabase/auth'
import { getMessages } from '@/lib/supabase/messaging'
import { getProposals } from '@/lib/supabase/deals'
import { buttonVariants } from '@/components/ui/button'
import ChatWindow from '@/components/messaging/chat-window'
import type { Database } from '@/types/database'

type MessageRow = Database['public']['Tables']['messages']['Row']
type ProposalRow = Database['public']['Tables']['proposals']['Row']

export default async function AthleteChatPage({
  params,
}: {
  params: Promise<{ matchId: string }>
}) {
  const { matchId } = await params
  const supabase = await createClient()
  const user = await getUser(supabase)
  if (!user) redirect('/auth')

  let messages: MessageRow[] = []
  let proposals: ProposalRow[] = []

  try {
    messages = (await getMessages(supabase, matchId)) as MessageRow[]
    proposals = (await getProposals(supabase, matchId)) as ProposalRow[]
  } catch {
    redirect('/athlete/messages')
  }

  return (
    <div className="mx-auto max-w-2xl h-screen flex flex-col">
      <div className="flex items-center gap-3 border-b px-4 py-3">
        <Link href="/athlete/messages" className={buttonVariants({ variant: 'ghost', size: 'sm' })}>
          ←
        </Link>
        <h1 className="font-semibold">Conversation</h1>
      </div>
      <ChatWindow
        matchId={matchId}
        initialMessages={messages}
        proposals={proposals}
        currentUserId={user.id}
      />
    </div>
  )
}
```

- [ ] **Step 5: Type-check**

```bash
npm run type-check
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add components/messaging/message-bubble.tsx components/messaging/proposal-card-message.tsx components/messaging/chat-window.tsx "app/(athlete)/athlete/messages/[matchId]/page.tsx"
git commit -m "feat(athlete): real-time chat with message bubble, proposal card, chat window"
```

---

## Task 11: Settings page

**Files:**
- Create: `components/athlete/settings-form.tsx`
- Create: `components/athlete/settings-form.test.tsx`
- Create: `app/(athlete)/athlete/settings/page.tsx`

- [ ] **Step 1: Write failing test**

```tsx
// components/athlete/settings-form.test.tsx
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import SettingsForm from './settings-form'
import type { Database } from '@/types/database'

type AthleteRow = Database['public']['Tables']['athlete_profiles']['Row']

const makeProfile = (): AthleteRow => ({
  id: 'p1',
  user_id: 'u1',
  display_name: 'James',
  full_legal_name: null,
  date_of_birth: null,
  phone: null,
  home_city: 'London',
  home_country: 'UK',
  primary_sport: 'Football',
  secondary_sport: null,
  level: 'amateur',
  position: null,
  years_active: null,
  height_cm: null,
  weight_kg: null,
  availability_status: 'available_now',
  available_from_date: null,
  travel_radius_km: null,
  seeking: [],
  social_accounts: {},
  notable_achievements: null,
  is_under_18: false,
  has_agent: false,
  guardian_name: null,
  guardian_relationship: null,
  guardian_email: null,
  guardian_phone: null,
  guardian_accepted_at: null,
  profile_photo_url: null,
  notification_prefs: {},
  performance_stats: {},
  discovery_ui_mode: 'marketplace',
  display_theme: 'light',
  status: 'active',
  last_active_at: null,
  created_at: '2024-01-01',
  updated_at: '2024-01-01',
})

describe('SettingsForm', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => makeProfile(),
    }))
  })

  it('renders display name field pre-populated', () => {
    render(<SettingsForm profile={makeProfile()} />)
    expect(screen.getByDisplayValue('James')).toBeInTheDocument()
  })

  it('calls PATCH /api/profiles/me on save', async () => {
    render(<SettingsForm profile={makeProfile()} />)
    await userEvent.clear(screen.getByLabelText(/display name/i))
    await userEvent.type(screen.getByLabelText(/display name/i), 'Jimmy')
    await userEvent.click(screen.getByRole('button', { name: /save/i }))
    await waitFor(() =>
      expect(fetch).toHaveBeenCalledWith('/api/profiles/me', expect.objectContaining({ method: 'PATCH' }))
    )
  })
})
```

- [ ] **Step 2: Run test — verify it fails**

```bash
npm run test -- settings-form
```

Expected: FAIL.

- [ ] **Step 3: Create settings form**

```tsx
// components/athlete/settings-form.tsx
'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import type { Database } from '@/types/database'

type AthleteRow = Database['public']['Tables']['athlete_profiles']['Row']

const schema = z.object({
  display_name: z.string().min(1, 'Display name is required').max(50),
  home_city: z.string().optional(),
  home_country: z.string().optional(),
  phone: z.string().optional(),
})
type FormValues = z.infer<typeof schema>

interface Props { profile: AthleteRow }

export default function SettingsForm({ profile }: Props) {
  const [loading, setLoading] = useState(false)
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      display_name: profile.display_name ?? '',
      home_city: profile.home_city ?? '',
      home_country: profile.home_country ?? '',
      phone: profile.phone ?? '',
    },
  })

  async function onSubmit(values: FormValues) {
    setLoading(true)
    try {
      const res = await fetch('/api/profiles/me', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error?.message ?? 'Failed to save'); return }
      toast.success('Settings saved')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 max-w-lg">
        <FormField control={form.control} name="display_name" render={({ field }) => (
          <FormItem>
            <FormLabel>Display name</FormLabel>
            <FormControl><Input {...field} /></FormControl>
            <FormMessage />
          </FormItem>
        )} />
        <div className="grid grid-cols-2 gap-4">
          <FormField control={form.control} name="home_city" render={({ field }) => (
            <FormItem>
              <FormLabel>City</FormLabel>
              <FormControl><Input {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )} />
          <FormField control={form.control} name="home_country" render={({ field }) => (
            <FormItem>
              <FormLabel>Country</FormLabel>
              <FormControl><Input {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )} />
        </div>
        <FormField control={form.control} name="phone" render={({ field }) => (
          <FormItem>
            <FormLabel>Phone <span className="text-muted-foreground text-xs">(private)</span></FormLabel>
            <FormControl><Input type="tel" {...field} /></FormControl>
            <FormMessage />
          </FormItem>
        )} />
        <Button type="submit" disabled={loading}>
          {loading ? 'Saving…' : 'Save settings'}
        </Button>
      </form>
    </Form>
  )
}
```

- [ ] **Step 4: Create settings page**

```tsx
// app/(athlete)/athlete/settings/page.tsx
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getUser } from '@/lib/supabase/auth'
import { getOwnProfile } from '@/lib/supabase/profiles'
import SettingsForm from '@/components/athlete/settings-form'
import type { Database } from '@/types/database'

type AthleteRow = Database['public']['Tables']['athlete_profiles']['Row']

export default async function AthleteSettingsPage() {
  const supabase = await createClient()
  const user = await getUser(supabase)
  if (!user) redirect('/auth')

  const profile = (await getOwnProfile(supabase, user.id, 'athlete')) as AthleteRow | null
  if (!profile) redirect('/athlete/onboarding')

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 space-y-6">
      <h1 className="text-2xl font-bold">Settings</h1>
      <SettingsForm profile={profile} />
    </div>
  )
}
```

- [ ] **Step 5: Run tests — verify they pass**

```bash
npm run test -- settings-form
```

Expected: PASS (2 tests).

- [ ] **Step 6: Commit**

```bash
git add components/athlete/settings-form.tsx components/athlete/settings-form.test.tsx "app/(athlete)/athlete/settings/page.tsx"
git commit -m "feat(athlete): settings form and page"
```

---

## Task 12: Final Phase 2 check

- [ ] **Step 1: Run full check**

```bash
npm run check
```

Expected: type-check clean, lint clean, all Vitest tests passing (≥ 511 + new tests from this phase).

- [ ] **Step 2: Fix any type or lint errors, then commit**

```bash
git add -A
git commit -m "fix(phase-2): type and lint corrections"
```

- [ ] **Step 3: Update handoff**

Update `docs/claude/handoff.md`:

```markdown
---
plan: docs/superpowers/plans/2026-04-21-athlete-dashboard.md
task: Phase 2 complete
status: complete
last_updated: <ISO timestamp>
head_sha: <git rev-parse HEAD>
---

<current_state>
Phase 2 (Athlete Dashboard) complete. All tasks done. Tests passing, type-check clean, lint clean. Ready to begin Phase 3 (Brand Dashboard).
</current_state>

<next_action>
Begin Phase 3 from the inventory in docs/superpowers/plans/2026-04-20-podium-frontend.md — requires a new detailed plan.
</next_action>
```

---

## Self-Review Checklist

### Spec coverage

| Spec requirement | Task |
|---|---|
| `components/layout/theme-toggle.tsx` | Task 1 |
| `components/layout/notification-bell.tsx` | Task 2 |
| `components/layout/nav-shell.tsx` | Task 3 |
| `app/(athlete)/layout.tsx` | Task 3 |
| `app/(athlete)/athlete/onboarding/page.tsx` | Task 4 |
| `app/(athlete)/athlete/onboarding/step/[step]/page.tsx` | Task 4 |
| `components/athlete/profile-wizard.tsx` (6 steps) | Task 4 |
| `components/athlete/guardian-form.tsx` | Task 5 |
| `app/(athlete)/athlete/onboarding/preview/page.tsx` | Task 5 |
| `components/athlete/profile-preview.tsx` | Task 5 |
| `app/(athlete)/athlete/dashboard/page.tsx` | Task 6 |
| `app/(athlete)/athlete/discover/page.tsx` | Task 7 |
| `components/discovery/listing-card.tsx` | Task 7 |
| `components/discovery/listings-grid.tsx` | Task 7 |
| `app/(athlete)/athlete/saved/page.tsx` | Task 8 |
| `app/(athlete)/athlete/requests/page.tsx` | Task 8 |
| `components/discovery/connection-request-card.tsx` | Task 8 |
| `app/(athlete)/athlete/messages/page.tsx` | Task 9 |
| `components/messaging/match-list.tsx` | Task 9 |
| `app/(athlete)/athlete/messages/[matchId]/page.tsx` | Task 10 |
| `components/messaging/chat-window.tsx` | Task 10 |
| `components/messaging/message-bubble.tsx` | Task 10 |
| `components/messaging/proposal-card-message.tsx` | Task 10 |
| `app/(athlete)/athlete/settings/page.tsx` | Task 11 |
| `components/athlete/settings-form.tsx` | Task 11 |

All spec items covered. ✓

### Known gaps / tech debt carried forward

- `requests-list.tsx` — direct Supabase query instead of lib wrapper (documented in code)
- Match list shows `user_id` not display name (brand profile lookup deferred to Phase 3)
- `app/api/profiles/me/publish/route.ts` is new — not in the original backend (publish was missing from Phase 1 API surface)
- Photo upload (`profile_photo_url`) not in wizard — requires presigned URL flow, deferred
