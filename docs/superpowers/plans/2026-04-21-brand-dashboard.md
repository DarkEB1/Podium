# Brand Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the complete Brand Dashboard — profile onboarding wizard, subscription management, athlete discovery, listing management, messaging + proposals, payments, and settings.

**Architecture:** `app/(brand)/layout.tsx` guards brand role. Server components fetch data via `lib/supabase/` helpers. `"use client"` only for form state and interactivity. Brands cannot self-publish — profiles go to `pending_approval` status and require admin activation. Stripe checkout uses a redirect flow.

**Tech Stack:** Next.js 15, TypeScript strict, Tailwind 4, shadcn/ui, react-hook-form + zod, sonner, Supabase JS 2.x

---

## File Map

| File | Action | `"use client"` |
|---|---|---|
| `app/dashboard/page.tsx` | Create — role-based redirect (fixes Stripe callback) | No |
| `app/(brand)/layout.tsx` | Create — auth guard + NavShell | No |
| `app/(brand)/brand/onboarding/page.tsx` | Create — redirect to step 1 | No |
| `app/(brand)/brand/onboarding/step/[step]/page.tsx` | Create — renders BrandProfileForm | No |
| `app/(brand)/brand/dashboard/page.tsx` | Create — dashboard with profile + subscription status | No |
| `app/(brand)/brand/discover/page.tsx` | Create — renders AthletesGrid with active athletes | No |
| `app/(brand)/brand/listings/page.tsx` | Create — brand's own listings | No |
| `app/(brand)/brand/listings/new/page.tsx` | Create — renders ListingForm (create mode) | No |
| `app/(brand)/brand/listings/[id]/page.tsx` | Create — renders ListingForm (edit mode) | No |
| `app/(brand)/brand/messages/page.tsx` | Create — renders MatchList | No |
| `app/(brand)/brand/messages/[matchId]/page.tsx` | Create — renders ChatWindow + ProposalForm | No |
| `app/(brand)/brand/subscription/page.tsx` | Create — renders SubscriptionTiers | No |
| `app/(brand)/brand/payments/page.tsx` | Create — payment history + PaymentForm | No |
| `app/(brand)/brand/settings/page.tsx` | Create — renders BrandSettingsForm + CancelSubscription | No |
| `components/brand/brand-profile-form.tsx` | Create — 4-step wizard | Yes |
| `components/brand/brand-profile-form.test.tsx` | Create — unit tests | — |
| `components/brand/subscription-tiers.tsx` | Create — tier selection + checkout | Yes |
| `components/brand/subscription-tiers.test.tsx` | Create — unit tests | — |
| `components/brand/athlete-card.tsx` | Create — athlete display + connect button | Yes |
| `components/brand/athletes-grid.tsx` | Create — filterable athletes grid | Yes |
| `components/brand/listing-form.tsx` | Create — create/edit listing | Yes |
| `components/brand/listing-form.test.tsx` | Create — unit tests | — |
| `components/brand/proposal-form.tsx` | Create — send proposal | Yes |
| `components/brand/proposal-form.test.tsx` | Create — unit tests | — |
| `components/brand/brand-settings-form.tsx` | Create — settings form | Yes |
| `components/brand/brand-settings-form.test.tsx` | Create — unit tests | — |
| `components/brand/cancel-subscription.tsx` | Create — cancel flow | Yes |
| `components/brand/payment-form.tsx` | Create — initiate payment | Yes |
| `lib/supabase/profiles.ts` | Modify — add `getActiveAthleteProfiles()` | — |
| `e2e/brand.spec.ts` | Create — Playwright brand flow | — |

---

## Task 1: Brand layout + onboarding entry points + lib helper

**Files:**
- Create: `app/(brand)/layout.tsx`
- Create: `app/(brand)/brand/onboarding/page.tsx`
- Create: `app/(brand)/brand/onboarding/step/[step]/page.tsx`
- Create: `app/dashboard/page.tsx`
- Modify: `lib/supabase/profiles.ts`

- [ ] **Step 1: Add `getActiveAthleteProfiles` to lib/supabase/profiles.ts**

Append this function at the end of `lib/supabase/profiles.ts` (before the final closing brace if any, or just at the end of the file):

```ts
export async function getActiveAthleteProfiles(
  supabase: SupabaseClient<Database>
): Promise<Database['public']['Tables']['athlete_profiles']['Row'][]> {
  const { data, error } = await (supabase as SupabaseClient)
    .from('athlete_profiles')
    .select('*')
    .eq('status', 'active')
    .order('updated_at', { ascending: false })

  if (error) throw new ProfileError('PROFILE_FETCH_FAILED', (error as { message: string }).message)
  return (data ?? []) as Database['public']['Tables']['athlete_profiles']['Row'][]
}
```

- [ ] **Step 2: Create brand layout**

```tsx
// app/(brand)/layout.tsx
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getUser } from '@/lib/supabase/auth'
import NavShell from '@/components/layout/nav-shell'

export default async function BrandLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const user = await getUser(supabase)

  if (!user) redirect('/auth')
  if (user.role !== 'brand') redirect('/403')

  return <NavShell role="brand">{children}</NavShell>
}
```

- [ ] **Step 3: Create onboarding redirect page**

```tsx
// app/(brand)/brand/onboarding/page.tsx
import { redirect } from 'next/navigation'

export default function BrandOnboardingPage() {
  redirect('/brand/onboarding/step/1')
}
```

- [ ] **Step 4: Create onboarding step page**

```tsx
// app/(brand)/brand/onboarding/step/[step]/page.tsx
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getUser } from '@/lib/supabase/auth'
import { getOwnProfile } from '@/lib/supabase/profiles'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import BrandProfileForm from '@/components/brand/brand-profile-form'
import type { Database } from '@/types/database'

type BrandRow = Database['public']['Tables']['brand_profiles']['Row']

const VALID_STEPS = [1, 2, 3, 4]

const STEP_TITLES: Record<number, string> = {
  1: 'Company basics',
  2: 'Targeting',
  3: 'About your brand',
  4: 'Review & submit',
}

export default async function BrandOnboardingStepPage({
  params,
}: {
  params: Promise<{ step: string }>
}) {
  const { step: stepParam } = await params
  const step = Number(stepParam)
  if (!VALID_STEPS.includes(step)) redirect('/brand/onboarding/step/1')

  const supabase = await createClient()
  const user = await getUser(supabase)
  if (!user) redirect('/auth')

  const profile = await getOwnProfile(supabase, user.id, 'brand') as BrandRow | null

  if (profile?.status === 'active') redirect('/brand/dashboard')

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-xl">
        <CardHeader>
          <CardTitle>Set up your brand — {STEP_TITLES[step]}</CardTitle>
        </CardHeader>
        <CardContent>
          <BrandProfileForm step={step} profile={profile} />
        </CardContent>
      </Card>
    </div>
  )
}
```

- [ ] **Step 5: Create role-based dashboard redirect (fixes Stripe callback)**

```tsx
// app/dashboard/page.tsx
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getUser } from '@/lib/supabase/auth'

const ROLE_DASHBOARD: Record<string, string> = {
  athlete: '/athlete/dashboard',
  brand: '/brand/dashboard',
  team: '/team/dashboard',
  agent: '/agent/dashboard',
  admin: '/admin/dashboard',
}

export default async function DashboardPage() {
  const supabase = await createClient()
  const user = await getUser(supabase)
  if (!user) redirect('/auth')
  const dest = user.role ? ROLE_DASHBOARD[user.role] : null
  redirect(dest ?? '/role-select')
}
```

- [ ] **Step 6: Run type-check**

```bash
npm run type-check
```

Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add "app/(brand)/layout.tsx" "app/(brand)/brand/onboarding/page.tsx" "app/(brand)/brand/onboarding/step/[step]/page.tsx" app/dashboard/page.tsx lib/supabase/profiles.ts
git commit -m "feat(brand): layout, onboarding entry points, getActiveAthleteProfiles lib helper"
```

---

## Task 2: BrandProfileForm (4-step wizard)

**Files:**
- Create: `components/brand/brand-profile-form.test.tsx`
- Create: `components/brand/brand-profile-form.tsx`

- [ ] **Step 1: Write failing tests**

```tsx
// components/brand/brand-profile-form.test.tsx
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import BrandProfileForm from './brand-profile-form'

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }))

describe('BrandProfileForm', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ id: '1', company_name: 'Acme', status: 'pending_approval' }),
    }))
  })

  it('step 1 renders company name field', () => {
    render(<BrandProfileForm step={1} profile={null} />)
    expect(screen.getByLabelText(/company name/i)).toBeInTheDocument()
  })

  it('step 1 shows validation error when company_name is empty', async () => {
    render(<BrandProfileForm step={1} profile={null} />)
    await userEvent.click(screen.getByRole('button', { name: /next/i }))
    expect(await screen.findByText(/company name is required/i)).toBeInTheDocument()
  })

  it('step 1 calls POST /api/profiles/me on first submission', async () => {
    render(<BrandProfileForm step={1} profile={null} />)
    await userEvent.type(screen.getByLabelText(/company name/i), 'Acme Corp')
    await userEvent.click(screen.getByRole('button', { name: /next/i }))
    await waitFor(() =>
      expect(fetch).toHaveBeenCalledWith('/api/profiles/me', expect.objectContaining({ method: 'POST' }))
    )
  })

  it('step 1 calls PATCH when profile already exists', async () => {
    const profile = { id: '1', company_name: 'Acme', status: 'pending_approval' } as never
    render(<BrandProfileForm step={1} profile={profile} />)
    await userEvent.clear(screen.getByLabelText(/company name/i))
    await userEvent.type(screen.getByLabelText(/company name/i), 'Acme Updated')
    await userEvent.click(screen.getByRole('button', { name: /next/i }))
    await waitFor(() =>
      expect(fetch).toHaveBeenCalledWith('/api/profiles/me', expect.objectContaining({ method: 'PATCH' }))
    )
  })

  it('step 4 renders a submit for review button', () => {
    const profile = { id: '1', company_name: 'Acme', status: 'pending_approval' } as never
    render(<BrandProfileForm step={4} profile={profile} />)
    expect(screen.getByRole('button', { name: /submit for review/i })).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test — verify it fails**

```bash
npm run test -- brand-profile-form
```

Expected: FAIL — `BrandProfileForm` not found.

- [ ] **Step 3: Implement BrandProfileForm**

```tsx
// components/brand/brand-profile-form.tsx
'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { cn } from '@/lib/utils'
import type { Database } from '@/types/database'

type BrandRow = Database['public']['Tables']['brand_profiles']['Row']
type BrandIndustry = Database['public']['Enums']['brand_industry']

// ─── Schemas ─────────────────────────────────────────────────────────────────

const step1Schema = z.object({
  company_name: z.string().min(1, 'Company name is required').max(100),
  trading_name: z.string().max(100).optional(),
  headquarters_city: z.string().optional(),
  headquarters_country: z.string().optional(),
  website_url: z.string().url('Must be a valid URL').optional().or(z.literal('')),
  linkedin_url: z.string().url('Must be a valid LinkedIn URL').optional().or(z.literal('')),
})

const step2Schema = z.object({
  industry: z.enum(['sport', 'fashion', 'nutrition', 'technology', 'financial', 'travel', 'entertainment', 'fmcg', 'other'] as const).optional(),
  target_level: z.string().optional(),
  geographic_preference: z.string().optional(),
})

const step3Schema = z.object({
  description: z.string().max(2000).optional(),
  company_registration_number: z.string().max(50).optional(),
  vat_number: z.string().max(50).optional(),
})

type Step1Values = z.infer<typeof step1Schema>
type Step2Values = z.infer<typeof step2Schema>
type Step3Values = z.infer<typeof step3Schema>

// ─── Helpers ──────────────────────────────────────────────────────────────────

const INDUSTRY_OPTIONS: { value: BrandIndustry; label: string }[] = [
  { value: 'sport', label: 'Sport' },
  { value: 'fashion', label: 'Fashion' },
  { value: 'nutrition', label: 'Nutrition & Health' },
  { value: 'technology', label: 'Technology' },
  { value: 'financial', label: 'Financial Services' },
  { value: 'travel', label: 'Travel & Tourism' },
  { value: 'entertainment', label: 'Entertainment & Media' },
  { value: 'fmcg', label: 'FMCG' },
  { value: 'other', label: 'Other' },
]

const SEEKING_OPTIONS = [
  { value: 'endorsement', label: 'Endorsement' },
  { value: 'team_sponsorship', label: 'Team Sponsorship' },
  { value: 'ambassador', label: 'Brand Ambassador' },
  { value: 'social_media', label: 'Social Media' },
  { value: 'event_appearance', label: 'Event Appearance' },
  { value: 'product_deal', label: 'Product Deal' },
]

const TARGET_SPORTS = [
  'Football', 'Athletics', 'Tennis', 'Basketball', 'Rugby', 'Cricket',
  'Cycling', 'Swimming', 'Golf', 'Boxing', 'MMA', 'Other',
]

function stepLabel(step: number): string {
  return { 1: 'Company Basics', 2: 'Targeting', 3: 'About', 4: 'Review' }[step] ?? ''
}

// ─── Step 1 ──────────────────────────────────────────────────────────────────

function Step1({
  profile,
  onSaved,
}: {
  profile: BrandRow | null
  onSaved: (p: BrandRow) => void
}) {
  const [loading, setLoading] = useState(false)
  const form = useForm<Step1Values>({
    resolver: zodResolver(step1Schema),
    defaultValues: {
      company_name: profile?.company_name ?? '',
      trading_name: profile?.trading_name ?? '',
      headquarters_city: profile?.headquarters_city ?? '',
      headquarters_country: profile?.headquarters_country ?? '',
      website_url: profile?.website_url ?? '',
      linkedin_url: profile?.linkedin_url ?? '',
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
      onSaved(data as BrandRow)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField control={form.control} name="company_name" render={({ field }) => (
          <FormItem>
            <FormLabel>Company name</FormLabel>
            <FormControl><Input placeholder="Acme Sports Ltd" {...field} /></FormControl>
            <FormMessage />
          </FormItem>
        )} />
        <FormField control={form.control} name="trading_name" render={({ field }) => (
          <FormItem>
            <FormLabel>Trading name <span className="text-muted-foreground text-xs">(optional)</span></FormLabel>
            <FormControl><Input placeholder="Acme" {...field} /></FormControl>
            <FormMessage />
          </FormItem>
        )} />
        <div className="grid grid-cols-2 gap-4">
          <FormField control={form.control} name="headquarters_city" render={({ field }) => (
            <FormItem>
              <FormLabel>City</FormLabel>
              <FormControl><Input placeholder="London" {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )} />
          <FormField control={form.control} name="headquarters_country" render={({ field }) => (
            <FormItem>
              <FormLabel>Country</FormLabel>
              <FormControl><Input placeholder="United Kingdom" {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )} />
        </div>
        <FormField control={form.control} name="website_url" render={({ field }) => (
          <FormItem>
            <FormLabel>Website <span className="text-muted-foreground text-xs">(optional)</span></FormLabel>
            <FormControl><Input type="url" placeholder="https://acme.com" {...field} /></FormControl>
            <FormMessage />
          </FormItem>
        )} />
        <FormField control={form.control} name="linkedin_url" render={({ field }) => (
          <FormItem>
            <FormLabel>LinkedIn <span className="text-muted-foreground text-xs">(optional)</span></FormLabel>
            <FormControl><Input type="url" placeholder="https://linkedin.com/company/acme" {...field} /></FormControl>
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

function Step2({
  profile,
  onSaved,
}: {
  profile: BrandRow | null
  onSaved: (p: BrandRow) => void
}) {
  const [loading, setLoading] = useState(false)
  const [seeking, setSeeking] = useState<string[]>(profile?.seeking ?? [])
  const [targetSports, setTargetSports] = useState<string[]>(profile?.target_sports ?? [])
  const form = useForm<Step2Values>({
    resolver: zodResolver(step2Schema),
    defaultValues: {
      industry: (profile?.industry as BrandIndustry | undefined) ?? undefined,
      target_level: profile?.target_level ?? '',
      geographic_preference: profile?.geographic_preference ?? '',
    },
  })

  function toggle(arr: string[], val: string, setter: (v: string[]) => void) {
    setter(arr.includes(val) ? arr.filter((s) => s !== val) : [...arr, val])
  }

  async function onSubmit(values: Step2Values) {
    setLoading(true)
    try {
      const res = await fetch('/api/profiles/me', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...values, seeking, target_sports: targetSports }),
      })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error?.message ?? 'Failed to save'); return }
      onSaved(data as BrandRow)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField control={form.control} name="industry" render={({ field }) => (
          <FormItem>
            <FormLabel>Industry</FormLabel>
            <Select onValueChange={field.onChange} defaultValue={field.value}>
              <FormControl>
                <SelectTrigger><SelectValue placeholder="Select industry" /></SelectTrigger>
              </FormControl>
              <SelectContent>
                {INDUSTRY_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <FormMessage />
          </FormItem>
        )} />
        <div>
          <p className="mb-2 text-sm font-medium">We are seeking to sponsor</p>
          <div className="flex flex-wrap gap-2">
            {SEEKING_OPTIONS.map((o) => (
              <button
                key={o.value}
                type="button"
                onClick={() => toggle(seeking, o.value, setSeeking)}
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
        <div>
          <p className="mb-2 text-sm font-medium">Target sports</p>
          <div className="flex flex-wrap gap-2">
            {TARGET_SPORTS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => toggle(targetSports, s, setTargetSports)}
                className={cn(
                  'rounded-full border px-3 py-1 text-sm transition-colors',
                  targetSports.includes(s)
                    ? 'border-foreground bg-foreground text-background'
                    : 'border-border hover:border-foreground/50'
                )}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
        <FormField control={form.control} name="target_level" render={({ field }) => (
          <FormItem>
            <FormLabel>Athlete/team level preference <span className="text-muted-foreground text-xs">(optional)</span></FormLabel>
            <FormControl><Input placeholder="e.g. Semi-Pro, Amateur" {...field} /></FormControl>
            <FormMessage />
          </FormItem>
        )} />
        <FormField control={form.control} name="geographic_preference" render={({ field }) => (
          <FormItem>
            <FormLabel>Geographic preference <span className="text-muted-foreground text-xs">(optional)</span></FormLabel>
            <FormControl><Input placeholder="e.g. United Kingdom, London only" {...field} /></FormControl>
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

// ─── Step 3 ──────────────────────────────────────────────────────────────────

function Step3({
  profile,
  onSaved,
}: {
  profile: BrandRow | null
  onSaved: (p: BrandRow) => void
}) {
  const [loading, setLoading] = useState(false)
  const form = useForm<Step3Values>({
    resolver: zodResolver(step3Schema),
    defaultValues: {
      description: profile?.description ?? '',
      company_registration_number: profile?.company_registration_number ?? '',
      vat_number: profile?.vat_number ?? '',
    },
  })

  async function onSubmit(values: Step3Values) {
    setLoading(true)
    try {
      const res = await fetch('/api/profiles/me', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error?.message ?? 'Failed to save'); return }
      onSaved(data as BrandRow)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField control={form.control} name="description" render={({ field }) => (
          <FormItem>
            <FormLabel>About your brand</FormLabel>
            <FormControl>
              <Textarea
                placeholder="Tell athletes and teams about your brand, your values, and what you're looking for in a sponsorship partner…"
                rows={5}
                className="resize-none"
                {...field}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )} />
        <FormField control={form.control} name="company_registration_number" render={({ field }) => (
          <FormItem>
            <FormLabel>Company registration number <span className="text-muted-foreground text-xs">(optional, private)</span></FormLabel>
            <FormControl><Input placeholder="12345678" {...field} /></FormControl>
            <FormMessage />
          </FormItem>
        )} />
        <FormField control={form.control} name="vat_number" render={({ field }) => (
          <FormItem>
            <FormLabel>VAT number <span className="text-muted-foreground text-xs">(optional, private)</span></FormLabel>
            <FormControl><Input placeholder="GB123456789" {...field} /></FormControl>
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

// ─── Step 4 (Review & Submit) ─────────────────────────────────────────────────

function Step4({ profile }: { profile: BrandRow | null }) {
  const router = useRouter()

  function handleSubmit() {
    toast.success('Profile submitted for review. You will be notified when approved.')
    router.push('/brand/subscription')
  }

  return (
    <div className="space-y-6">
      <div className="rounded-xl border bg-muted/30 p-4 space-y-2">
        <p className="text-sm font-semibold">Profile summary</p>
        <dl className="space-y-1 text-sm">
          <div className="flex gap-2">
            <dt className="text-muted-foreground w-40">Company</dt>
            <dd>{profile?.company_name ?? '—'}</dd>
          </div>
          <div className="flex gap-2">
            <dt className="text-muted-foreground w-40">Industry</dt>
            <dd>{profile?.industry?.replace('_', ' ') ?? '—'}</dd>
          </div>
          <div className="flex gap-2">
            <dt className="text-muted-foreground w-40">Location</dt>
            <dd>{[profile?.headquarters_city, profile?.headquarters_country].filter(Boolean).join(', ') || '—'}</dd>
          </div>
          <div className="flex gap-2">
            <dt className="text-muted-foreground w-40">Website</dt>
            <dd>{profile?.website_url ?? '—'}</dd>
          </div>
        </dl>
      </div>
      <p className="text-xs text-muted-foreground">
        Your profile will be reviewed by the Podium team. Meanwhile, set up your subscription to start discovering athletes and teams.
      </p>
      <Button className="w-full" onClick={handleSubmit}>
        Submit for review →
      </Button>
    </div>
  )
}

// ─── Main wizard ──────────────────────────────────────────────────────────────

interface Props {
  step: number
  profile: BrandRow | null
}

export default function BrandProfileForm({ step, profile: initialProfile }: Props) {
  const router = useRouter()
  const [profile, setProfile] = useState<BrandRow | null>(initialProfile)

  function handleSaved(saved: BrandRow) {
    setProfile(saved)
    if (step < 4) router.push(`/brand/onboarding/step/${step + 1}`)
  }

  function handleBack() {
    if (step > 1) router.push(`/brand/onboarding/step/${step - 1}`)
  }

  const TOTAL_STEPS = 4

  return (
    <div className="space-y-6">
      <div>
        <div className="flex justify-between text-xs text-muted-foreground mb-1">
          <span>Step {step} of {TOTAL_STEPS} — {stepLabel(step)}</span>
          <span>{Math.round((step / TOTAL_STEPS) * 100)}%</span>
        </div>
        <div className="h-1.5 rounded-full bg-muted overflow-hidden">
          <div className="h-full bg-foreground transition-all" style={{ width: `${(step / TOTAL_STEPS) * 100}%` }} />
        </div>
      </div>

      {step === 1 && <Step1 profile={profile} onSaved={handleSaved} />}
      {step === 2 && <Step2 profile={profile} onSaved={handleSaved} />}
      {step === 3 && <Step3 profile={profile} onSaved={handleSaved} />}
      {step === 4 && <Step4 profile={profile} />}

      {step > 1 && step < 4 && (
        <Button variant="ghost" size="sm" className="w-full" onClick={handleBack}>
          ← Back
        </Button>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Run tests — verify they pass**

```bash
npm run test -- brand-profile-form
```

Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add components/brand/brand-profile-form.tsx components/brand/brand-profile-form.test.tsx
git commit -m "feat(brand): 4-step brand profile wizard with tests"
```

---

## Task 3: Subscription page + SubscriptionTiers

**Files:**
- Create: `components/brand/subscription-tiers.test.tsx`
- Create: `components/brand/subscription-tiers.tsx`
- Create: `app/(brand)/brand/subscription/page.tsx`

- [ ] **Step 1: Write failing tests**

```tsx
// components/brand/subscription-tiers.test.tsx
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import SubscriptionTiers from './subscription-tiers'

describe('SubscriptionTiers', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ url: 'https://checkout.stripe.com/test' }),
    }))
  })

  it('renders all 3 tiers', () => {
    render(<SubscriptionTiers subscription={null} />)
    expect(screen.getByText(/tier 1/i)).toBeInTheDocument()
    expect(screen.getByText(/tier 2/i)).toBeInTheDocument()
    expect(screen.getByText(/tier 3/i)).toBeInTheDocument()
  })

  it('subscribe button is disabled until a tier is selected', () => {
    render(<SubscriptionTiers subscription={null} />)
    expect(screen.getByRole('button', { name: /subscribe/i })).toBeDisabled()
  })

  it('subscribe button enables after selecting a tier', async () => {
    render(<SubscriptionTiers subscription={null} />)
    await userEvent.click(screen.getAllByRole('button', { name: /tier/i })[0])
    expect(screen.getByRole('button', { name: /subscribe/i })).not.toBeDisabled()
  })

  it('calls POST /api/payments/subscriptions/checkout with selected tier', async () => {
    Object.defineProperty(window, 'location', { value: { href: '' }, writable: true })
    render(<SubscriptionTiers subscription={null} />)
    await userEvent.click(screen.getAllByRole('button', { name: /tier/i })[1])
    await userEvent.click(screen.getByRole('button', { name: /subscribe/i }))
    await waitFor(() =>
      expect(fetch).toHaveBeenCalledWith(
        '/api/payments/subscriptions/checkout',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ tier: 2 }),
        })
      )
    )
  })

  it('shows current subscription when already subscribed', () => {
    const sub = { id: '1', tier: 2, status: 'active', stripe_subscription_id: 'sub_123', stripe_customer_id: 'cus_123', brand_id: 'b1', current_period_start: '', current_period_end: '', created_at: '', updated_at: '', canceled_at: null, cancellation_scheduled_at: null, trial_ends_at: null }
    render(<SubscriptionTiers subscription={sub} />)
    expect(screen.getByText(/current plan/i)).toBeInTheDocument()
    expect(screen.getByText(/tier 2/i)).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test — verify it fails**

```bash
npm run test -- subscription-tiers
```

Expected: FAIL — `SubscriptionTiers` not found.

- [ ] **Step 3: Implement SubscriptionTiers**

```tsx
// components/brand/subscription-tiers.tsx
'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { Database } from '@/types/database'

type SubscriptionRow = Database['public']['Tables']['subscriptions']['Row']

interface Props { subscription: SubscriptionRow | null }

const TIERS: { tier: 1 | 2 | 3; name: string; price: string; features: string[] }[] = [
  {
    tier: 1,
    name: 'Tier 1',
    price: '£99/mo',
    features: ['Up to 50 connection requests/mo', 'Basic search filters', 'Message 10 athletes/mo', '7-day free trial'],
  },
  {
    tier: 2,
    name: 'Tier 2',
    price: '£249/mo',
    features: ['Up to 200 connection requests/mo', 'Advanced search + filters', 'Unlimited messaging', 'Priority support', '7-day free trial'],
  },
  {
    tier: 3,
    name: 'Tier 3',
    price: '£599/mo',
    features: ['Unlimited connections', 'Full search suite', 'Unlimited messaging', 'Dedicated account manager', 'Analytics dashboard', '7-day free trial'],
  },
]

export default function SubscriptionTiers({ subscription }: Props) {
  const [selected, setSelected] = useState<1 | 2 | 3 | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubscribe() {
    if (!selected) return
    setLoading(true)
    try {
      const res = await fetch('/api/payments/subscriptions/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tier: selected }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error?.message ?? 'Failed to start checkout')
        return
      }
      window.location.href = data.url
    } finally {
      setLoading(false)
    }
  }

  if (subscription) {
    const currentTier = TIERS.find((t) => t.tier === subscription.tier)
    return (
      <div className="space-y-4">
        <div className="rounded-xl border bg-muted/30 p-4 space-y-2">
          <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Current plan</p>
          <p className="text-xl font-bold">{currentTier?.name ?? `Tier ${subscription.tier}`}</p>
          <p className="text-sm text-muted-foreground capitalize">{subscription.status}</p>
          {subscription.trial_ends_at && new Date(subscription.trial_ends_at) > new Date() && (
            <p className="text-xs text-yellow-600 dark:text-yellow-400">
              Free trial ends {new Date(subscription.trial_ends_at).toLocaleDateString()}
            </p>
          )}
          {subscription.cancellation_scheduled_at && (
            <p className="text-xs text-red-600 dark:text-red-400">
              Cancels at end of billing period ({new Date(subscription.current_period_end).toLocaleDateString()})
            </p>
          )}
        </div>
        <p className="text-sm text-muted-foreground">
          To change your plan, contact <a href="mailto:support@podium.com" className="underline">support@podium.com</a>.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        {TIERS.map((t) => (
          <button
            key={t.tier}
            type="button"
            aria-label={`${t.name} — ${t.price}`}
            onClick={() => setSelected(t.tier)}
            className={cn(
              'rounded-xl border p-5 text-left transition-all space-y-3',
              selected === t.tier
                ? 'border-foreground bg-foreground/5 ring-2 ring-foreground'
                : 'border-border hover:border-foreground/50'
            )}
          >
            <div>
              <p className="font-bold">{t.name}</p>
              <p className="text-2xl font-extrabold mt-1">{t.price}</p>
            </div>
            <ul className="space-y-1">
              {t.features.map((f) => (
                <li key={f} className="flex items-start gap-2 text-sm text-muted-foreground">
                  <span className="text-green-500 mt-0.5">✓</span>
                  {f}
                </li>
              ))}
            </ul>
          </button>
        ))}
      </div>
      <Button className="w-full" disabled={!selected || loading} onClick={handleSubscribe}>
        {loading ? 'Redirecting to checkout…' : 'Subscribe'}
      </Button>
      <p className="text-center text-xs text-muted-foreground">
        All tiers include a 7-day free trial. Cancel anytime from Settings.
      </p>
    </div>
  )
}
```

- [ ] **Step 4: Create subscription page**

```tsx
// app/(brand)/brand/subscription/page.tsx
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getUser } from '@/lib/supabase/auth'
import { getSubscriptionForUser } from '@/lib/supabase/payments'
import SubscriptionTiers from '@/components/brand/subscription-tiers'
import type { Database } from '@/types/database'

type SubscriptionRow = Database['public']['Tables']['subscriptions']['Row']

export default async function BrandSubscriptionPage() {
  const supabase = await createClient()
  const user = await getUser(supabase)
  if (!user) redirect('/auth')

  const subscription = await getSubscriptionForUser(supabase, user.id) as SubscriptionRow | null

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Subscription</h1>
        <p className="text-muted-foreground">
          {subscription
            ? 'Manage your current plan.'
            : 'Choose a plan to start discovering athletes and teams.'}
        </p>
      </div>
      <SubscriptionTiers subscription={subscription} />
    </div>
  )
}
```

- [ ] **Step 5: Run tests — verify they pass**

```bash
npm run test -- subscription-tiers
```

Expected: PASS (5 tests).

- [ ] **Step 6: Commit**

```bash
git add components/brand/subscription-tiers.tsx components/brand/subscription-tiers.test.tsx "app/(brand)/brand/subscription/page.tsx"
git commit -m "feat(brand): subscription tiers component and page with tests"
```

---

## Task 4: Brand dashboard page

**Files:**
- Create: `app/(brand)/brand/dashboard/page.tsx`

- [ ] **Step 1: Create brand dashboard**

```tsx
// app/(brand)/brand/dashboard/page.tsx
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getUser } from '@/lib/supabase/auth'
import { getOwnProfile } from '@/lib/supabase/profiles'
import { getSubscriptionForUser } from '@/lib/supabase/payments'
import { getMatches } from '@/lib/supabase/messaging'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { Database } from '@/types/database'

type BrandRow = Database['public']['Tables']['brand_profiles']['Row']
type SubscriptionRow = Database['public']['Tables']['subscriptions']['Row']
type MatchRow = Database['public']['Tables']['matches']['Row']

export default async function BrandDashboardPage() {
  const supabase = await createClient()
  const user = await getUser(supabase)
  if (!user) redirect('/auth')

  const [profile, subscription, matches] = await Promise.all([
    getOwnProfile(supabase, user.id, 'brand') as Promise<BrandRow | null>,
    getSubscriptionForUser(supabase, user.id) as Promise<SubscriptionRow | null>,
    getMatches(supabase, user.id) as Promise<MatchRow[]>,
  ])

  if (!profile) redirect('/brand/onboarding')

  const activeMatches = matches.filter((m) => m.status === 'active')
  const isActive = profile.status === 'active'
  const hasSubscription = subscription && ['active', 'trialing'].includes(subscription.status)

  return (
    <div className="mx-auto max-w-5xl space-y-8 px-4 py-8">
      <div>
        <h1 className="text-2xl font-bold">Welcome, {profile.trading_name ?? profile.company_name}</h1>
        <p className="text-muted-foreground">
          {profile.status === 'pending_approval'
            ? 'Your profile is under review. You will be notified when approved.'
            : profile.status === 'active'
            ? 'Your profile is live and visible to athletes.'
            : `Profile status: ${profile.status}`}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Profile status</CardTitle>
          </CardHeader>
          <CardContent>
            <span className={cn(
              'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
              profile.status === 'active'
                ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
            )}>
              {profile.status.replace('_', ' ')}
            </span>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Subscription</CardTitle>
          </CardHeader>
          <CardContent>
            {subscription ? (
              <span className={cn(
                'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
                hasSubscription
                  ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                  : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
              )}>
                Tier {subscription.tier} · {subscription.status}
              </span>
            ) : (
              <Link href="/brand/subscription" className="text-sm underline text-muted-foreground hover:text-foreground">
                Set up subscription
              </Link>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Active conversations</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{activeMatches.length}</p>
          </CardContent>
        </Card>
      </div>

      {!hasSubscription && (
        <div className="rounded-xl border border-yellow-200 bg-yellow-50 dark:border-yellow-800 dark:bg-yellow-900/20 p-4">
          <p className="text-sm font-medium text-yellow-800 dark:text-yellow-200">Subscription required</p>
          <p className="text-sm text-yellow-700 dark:text-yellow-300 mt-1">
            Set up a subscription to discover and connect with athletes and teams.
          </p>
          <Link href="/brand/subscription" className={cn(buttonVariants({ size: 'sm' }), 'mt-3')}>
            Choose a plan
          </Link>
        </div>
      )}

      {isActive && (
        <div className="flex flex-wrap gap-3">
          <Link href="/brand/discover" className={buttonVariants()}>Discover athletes</Link>
          <Link href="/brand/listings" className={buttonVariants({ variant: 'outline' })}>My listings</Link>
          <Link href="/brand/messages" className={buttonVariants({ variant: 'outline' })}>
            Messages ({activeMatches.length})
          </Link>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Run type-check**

```bash
npm run type-check
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add "app/(brand)/brand/dashboard/page.tsx"
git commit -m "feat(brand): dashboard page with subscription and profile status"
```

---

## Task 5: Discover page + AthleteCard + AthletesGrid

**Files:**
- Create: `components/brand/athlete-card.tsx`
- Create: `components/brand/athletes-grid.tsx`
- Create: `app/(brand)/brand/discover/page.tsx`

- [ ] **Step 1: Create AthleteCard**

```tsx
// components/brand/athlete-card.tsx
'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import type { Database } from '@/types/database'

type AthleteRow = Database['public']['Tables']['athlete_profiles']['Row']

interface Props { athlete: AthleteRow }

export default function AthleteCard({ athlete }: Props) {
  const [open, setOpen] = useState(false)
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleConnect() {
    if (!message.trim()) { toast.error('Please write a message'); return }
    setLoading(true)
    try {
      const res = await fetch('/api/discovery/connections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recipient_id: athlete.user_id, message }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error?.message ?? 'Failed to send request')
        return
      }
      toast.success('Connection request sent!')
      setOpen(false)
      setMessage('')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="rounded-xl border bg-card p-5 shadow-sm space-y-3 hover:shadow-md transition-shadow">
      <div className="flex items-start gap-3">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-bold">
          {(athlete.display_name ?? '?')[0]?.toUpperCase()}
        </div>
        <div className="min-w-0">
          <p className="font-semibold truncate">{athlete.display_name ?? 'Unknown'}</p>
          <p className="text-xs text-muted-foreground">
            {[athlete.primary_sport, athlete.level?.replace('_', ' ')].filter(Boolean).join(' · ')}
          </p>
          <p className="text-xs text-muted-foreground">
            {[athlete.home_city, athlete.home_country].filter(Boolean).join(', ')}
          </p>
        </div>
      </div>

      {athlete.seeking.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {athlete.seeking.slice(0, 3).map((s) => (
            <span key={s} className="rounded-full bg-muted px-2 py-0.5 text-xs">
              {s.replace('_', ' ')}
            </span>
          ))}
        </div>
      )}

      {!open ? (
        <Button size="sm" className="w-full" onClick={() => setOpen(true)}>
          Connect
        </Button>
      ) : (
        <div className="space-y-2">
          <Textarea
            placeholder="Introduce your brand and what you're looking for…"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={3}
            className="resize-none text-sm"
            maxLength={500}
          />
          <div className="flex gap-2">
            <Button size="sm" className="flex-1" onClick={handleConnect} disabled={loading}>
              {loading ? 'Sending…' : 'Send request'}
            </Button>
            <Button size="sm" variant="outline" onClick={() => { setOpen(false); setMessage('') }}>
              Cancel
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Create AthletesGrid**

```tsx
// components/brand/athletes-grid.tsx
'use client'

import { useState } from 'react'
import { Input } from '@/components/ui/input'
import AthleteCard from './athlete-card'
import type { Database } from '@/types/database'

type AthleteRow = Database['public']['Tables']['athlete_profiles']['Row']

interface Props { athletes: AthleteRow[] }

export default function AthletesGrid({ athletes }: Props) {
  const [search, setSearch] = useState('')

  const filtered = athletes.filter((a) => {
    if (!search) return true
    const q = search.toLowerCase()
    return (
      a.display_name?.toLowerCase().includes(q) ||
      a.primary_sport?.toLowerCase().includes(q) ||
      a.home_city?.toLowerCase().includes(q) ||
      a.home_country?.toLowerCase().includes(q) ||
      a.level?.toLowerCase().includes(q)
    )
  })

  return (
    <div className="space-y-4">
      <Input
        placeholder="Search by name, sport, location…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="max-w-sm"
      />
      {filtered.length === 0 ? (
        <p className="text-center text-muted-foreground py-12">No athletes match your search.</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((a) => <AthleteCard key={a.id} athlete={a} />)}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Create discover page**

```tsx
// app/(brand)/brand/discover/page.tsx
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getUser } from '@/lib/supabase/auth'
import { getActiveAthleteProfiles } from '@/lib/supabase/profiles'
import AthletesGrid from '@/components/brand/athletes-grid'

export default async function BrandDiscoverPage() {
  const supabase = await createClient()
  const user = await getUser(supabase)
  if (!user) redirect('/auth')

  const athletes = await getActiveAthleteProfiles(supabase)

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Discover athletes</h1>
        <p className="text-muted-foreground">{athletes.length} active athletes on Podium</p>
      </div>
      <AthletesGrid athletes={athletes} />
    </div>
  )
}
```

- [ ] **Step 4: Run type-check**

```bash
npm run type-check
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add components/brand/athlete-card.tsx components/brand/athletes-grid.tsx "app/(brand)/brand/discover/page.tsx"
git commit -m "feat(brand): discover page with athlete grid and connect flow"
```

---

## Task 6: Listings management

**Files:**
- Create: `components/brand/listing-form.test.tsx`
- Create: `components/brand/listing-form.tsx`
- Create: `app/(brand)/brand/listings/page.tsx`
- Create: `app/(brand)/brand/listings/new/page.tsx`
- Create: `app/(brand)/brand/listings/[id]/page.tsx`

- [ ] **Step 1: Write failing tests**

```tsx
// components/brand/listing-form.test.tsx
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import ListingForm from './listing-form'

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }))

describe('ListingForm', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ id: 'list-1', title: 'Test', type: 'athlete_endorsement', status: 'draft' }),
    }))
  })

  it('renders title and type fields', () => {
    render(<ListingForm listing={null} />)
    expect(screen.getByLabelText(/title/i)).toBeInTheDocument()
    expect(screen.getByText(/listing type/i)).toBeInTheDocument()
  })

  it('shows validation error when title is empty', async () => {
    render(<ListingForm listing={null} />)
    await userEvent.click(screen.getByRole('button', { name: /save draft/i }))
    expect(await screen.findByText(/title is required/i)).toBeInTheDocument()
  })

  it('calls POST /api/discovery/listings on create', async () => {
    render(<ListingForm listing={null} />)
    await userEvent.type(screen.getByLabelText(/title/i), 'Summer Sponsorship 2026')
    await userEvent.click(screen.getByRole('button', { name: /save draft/i }))
    await waitFor(() =>
      expect(fetch).toHaveBeenCalledWith('/api/discovery/listings', expect.objectContaining({ method: 'POST' }))
    )
  })

  it('calls PATCH on edit', async () => {
    const listing = { id: 'list-1', title: 'Old Title', type: 'athlete_endorsement', status: 'draft', brand_id: 'b1', created_at: '', updated_at: '', description: null, sport_required: null, level_required: null, location: null, is_remote: false, pay_type: null, pay_amount: null, pay_currency: 'GBP', contract_duration_months: null, application_deadline: null, exclusivity_required: false, multiple_hires: false, max_hires: null, number_of_teams_sought: null, total_sponsorship_budget: null, sponsorship_structure: null, deliverables: [], what_expected: null, usage_rights: null } as never
    render(<ListingForm listing={listing} />)
    await userEvent.clear(screen.getByLabelText(/title/i))
    await userEvent.type(screen.getByLabelText(/title/i), 'New Title')
    await userEvent.click(screen.getByRole('button', { name: /save draft/i }))
    await waitFor(() =>
      expect(fetch).toHaveBeenCalledWith(`/api/discovery/listings/list-1`, expect.objectContaining({ method: 'PATCH' }))
    )
  })
})
```

- [ ] **Step 2: Run test — verify it fails**

```bash
npm run test -- listing-form
```

Expected: FAIL — `ListingForm` not found.

- [ ] **Step 3: Implement ListingForm**

```tsx
// components/brand/listing-form.tsx
'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import type { Database } from '@/types/database'

type JobListingRow = Database['public']['Tables']['job_listings']['Row']
type ListingType = Database['public']['Enums']['listing_type']
type PayType = Database['public']['Enums']['pay_type']

const schema = z.object({
  title: z.string().min(1, 'Title is required').max(200),
  type: z.enum(['athlete_endorsement', 'team_sponsorship'] as const),
  description: z.string().max(2000).optional(),
  sport_required: z.string().optional(),
  level_required: z.string().optional(),
  location: z.string().optional(),
  is_remote: z.boolean().optional(),
  pay_type: z.enum(['flat_fee', 'monthly_retainer', 'per_post', 'revenue_share'] as const).optional(),
  pay_amount: z.coerce.number().positive('Must be positive').optional(),
  pay_currency: z.string().length(3).optional(),
  contract_duration_months: z.coerce.number().int().min(1).max(36).optional(),
  application_deadline: z.string().optional(),
})

type FormValues = z.infer<typeof schema>

interface Props { listing: JobListingRow | null }

const LISTING_TYPE_LABEL: Record<ListingType, string> = {
  athlete_endorsement: 'Athlete endorsement',
  team_sponsorship: 'Team sponsorship',
}

const PAY_TYPE_LABEL: Record<PayType, string> = {
  flat_fee: 'Flat fee',
  monthly_retainer: 'Monthly retainer',
  per_post: 'Per post',
  revenue_share: 'Revenue share',
}

export default function ListingForm({ listing }: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      title: listing?.title ?? '',
      type: (listing?.type as ListingType | undefined) ?? 'athlete_endorsement',
      description: listing?.description ?? '',
      sport_required: listing?.sport_required ?? '',
      level_required: listing?.level_required ?? '',
      location: listing?.location ?? '',
      is_remote: listing?.is_remote ?? false,
      pay_type: (listing?.pay_type as PayType | undefined) ?? undefined,
      pay_amount: listing?.pay_amount ?? undefined,
      pay_currency: listing?.pay_currency ?? 'GBP',
      contract_duration_months: listing?.contract_duration_months ?? undefined,
      application_deadline: listing?.application_deadline ?? '',
    },
  })

  async function onSubmit(values: FormValues) {
    setLoading(true)
    try {
      const url = listing
        ? `/api/discovery/listings/${listing.id}`
        : '/api/discovery/listings'
      const method = listing ? 'PATCH' : 'POST'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error?.message ?? 'Failed to save'); return }
      toast.success(listing ? 'Listing updated' : 'Listing created')
      router.push('/brand/listings')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 max-w-2xl">
        <FormField control={form.control} name="title" render={({ field }) => (
          <FormItem>
            <FormLabel>Title</FormLabel>
            <FormControl><Input placeholder="Summer 2026 Football Sponsorship" {...field} /></FormControl>
            <FormMessage />
          </FormItem>
        )} />

        <FormField control={form.control} name="type" render={({ field }) => (
          <FormItem>
            <FormLabel>Listing type</FormLabel>
            <Select onValueChange={field.onChange} defaultValue={field.value}>
              <FormControl>
                <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
              </FormControl>
              <SelectContent>
                {(Object.entries(LISTING_TYPE_LABEL) as [ListingType, string][]).map(([v, l]) => (
                  <SelectItem key={v} value={v}>{l}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <FormMessage />
          </FormItem>
        )} />

        <FormField control={form.control} name="description" render={({ field }) => (
          <FormItem>
            <FormLabel>Description <span className="text-muted-foreground text-xs">(optional)</span></FormLabel>
            <FormControl>
              <Textarea rows={4} className="resize-none" placeholder="Describe what you're looking for…" {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )} />

        <div className="grid grid-cols-2 gap-4">
          <FormField control={form.control} name="sport_required" render={({ field }) => (
            <FormItem>
              <FormLabel>Sport <span className="text-muted-foreground text-xs">(optional)</span></FormLabel>
              <FormControl><Input placeholder="Football" {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )} />
          <FormField control={form.control} name="level_required" render={({ field }) => (
            <FormItem>
              <FormLabel>Level <span className="text-muted-foreground text-xs">(optional)</span></FormLabel>
              <FormControl><Input placeholder="Semi-Pro" {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )} />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <FormField control={form.control} name="location" render={({ field }) => (
            <FormItem>
              <FormLabel>Location <span className="text-muted-foreground text-xs">(optional)</span></FormLabel>
              <FormControl><Input placeholder="London" {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )} />
          <FormField control={form.control} name="contract_duration_months" render={({ field }) => (
            <FormItem>
              <FormLabel>Duration (months) <span className="text-muted-foreground text-xs">(optional)</span></FormLabel>
              <FormControl><Input type="number" min={1} max={36} placeholder="12" {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )} />
        </div>

        <FormField control={form.control} name="pay_type" render={({ field }) => (
          <FormItem>
            <FormLabel>Pay type <span className="text-muted-foreground text-xs">(optional)</span></FormLabel>
            <Select onValueChange={field.onChange} defaultValue={field.value}>
              <FormControl>
                <SelectTrigger><SelectValue placeholder="Select pay type" /></SelectTrigger>
              </FormControl>
              <SelectContent>
                {(Object.entries(PAY_TYPE_LABEL) as [PayType, string][]).map(([v, l]) => (
                  <SelectItem key={v} value={v}>{l}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <FormMessage />
          </FormItem>
        )} />

        <div className="grid grid-cols-2 gap-4">
          <FormField control={form.control} name="pay_amount" render={({ field }) => (
            <FormItem>
              <FormLabel>Amount <span className="text-muted-foreground text-xs">(optional)</span></FormLabel>
              <FormControl><Input type="number" min={0} placeholder="5000" {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )} />
          <FormField control={form.control} name="pay_currency" render={({ field }) => (
            <FormItem>
              <FormLabel>Currency</FormLabel>
              <FormControl><Input placeholder="GBP" maxLength={3} {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )} />
        </div>

        <FormField control={form.control} name="application_deadline" render={({ field }) => (
          <FormItem>
            <FormLabel>Application deadline <span className="text-muted-foreground text-xs">(optional)</span></FormLabel>
            <FormControl><Input type="date" {...field} /></FormControl>
            <FormMessage />
          </FormItem>
        )} />

        <Button type="submit" disabled={loading}>
          {loading ? 'Saving…' : 'Save draft'}
        </Button>
      </form>
    </Form>
  )
}
```

- [ ] **Step 4: Create listings pages**

```tsx
// app/(brand)/brand/listings/page.tsx
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getUser } from '@/lib/supabase/auth'
import { getOwnProfile } from '@/lib/supabase/profiles'
import { getListings } from '@/lib/supabase/discovery'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { Database } from '@/types/database'

type BrandRow = Database['public']['Tables']['brand_profiles']['Row']
type JobListingRow = Database['public']['Tables']['job_listings']['Row']

export default async function BrandListingsPage() {
  const supabase = await createClient()
  const user = await getUser(supabase)
  if (!user) redirect('/auth')

  const profile = await getOwnProfile(supabase, user.id, 'brand') as BrandRow | null
  if (!profile) redirect('/brand/onboarding')

  const allListings = await getListings(supabase) as JobListingRow[]
  const myListings = allListings.filter((l) => l.brand_id === profile.id)

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">My listings</h1>
        <Link href="/brand/listings/new" className={buttonVariants()}>+ New listing</Link>
      </div>

      {myListings.length === 0 ? (
        <div className="rounded-xl border border-dashed p-12 text-center">
          <p className="text-muted-foreground">No listings yet.</p>
          <Link href="/brand/listings/new" className={cn(buttonVariants({ variant: 'outline' }), 'mt-4')}>
            Create your first listing
          </Link>
        </div>
      ) : (
        <ul className="divide-y rounded-xl border">
          {myListings.map((l) => (
            <li key={l.id}>
              <Link
                href={`/brand/listings/${l.id}`}
                className="flex items-center justify-between px-4 py-3 hover:bg-muted/50 transition-colors"
              >
                <div>
                  <p className="font-medium">{l.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {l.type.replace('_', ' ')} · {l.sport_required ?? 'Any sport'} · {l.status}
                  </p>
                </div>
                <span className={cn(
                  'text-xs rounded-full px-2 py-0.5 font-medium',
                  l.status === 'active' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-muted text-muted-foreground'
                )}>
                  {l.status}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
```

```tsx
// app/(brand)/brand/listings/new/page.tsx
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import ListingForm from '@/components/brand/listing-form'

export default function NewListingPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <Card>
        <CardHeader>
          <CardTitle>Create a listing</CardTitle>
        </CardHeader>
        <CardContent>
          <ListingForm listing={null} />
        </CardContent>
      </Card>
    </div>
  )
}
```

```tsx
// app/(brand)/brand/listings/[id]/page.tsx
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getUser } from '@/lib/supabase/auth'
import { getOwnProfile } from '@/lib/supabase/profiles'
import { getListing } from '@/lib/supabase/discovery'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import ListingForm from '@/components/brand/listing-form'
import type { Database } from '@/types/database'

type BrandRow = Database['public']['Tables']['brand_profiles']['Row']
type JobListingRow = Database['public']['Tables']['job_listings']['Row']

export default async function EditListingPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()
  const user = await getUser(supabase)
  if (!user) redirect('/auth')

  const profile = await getOwnProfile(supabase, user.id, 'brand') as BrandRow | null
  if (!profile) redirect('/brand/onboarding')

  const listing = await getListing(supabase, id) as JobListingRow | null
  if (!listing || listing.brand_id !== profile.id) redirect('/brand/listings')

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <Card>
        <CardHeader>
          <CardTitle>Edit listing</CardTitle>
        </CardHeader>
        <CardContent>
          <ListingForm listing={listing} />
        </CardContent>
      </Card>
    </div>
  )
}
```

- [ ] **Step 5: Run tests — verify they pass**

```bash
npm run test -- listing-form
```

Expected: PASS (4 tests).

- [ ] **Step 6: Commit**

```bash
git add components/brand/listing-form.tsx components/brand/listing-form.test.tsx "app/(brand)/brand/listings/page.tsx" "app/(brand)/brand/listings/new/page.tsx" "app/(brand)/brand/listings/[id]/page.tsx"
git commit -m "feat(brand): listings management — list, create, edit pages with tested form"
```

---

## Task 7: Messages + ProposalForm

**Files:**
- Create: `components/brand/proposal-form.test.tsx`
- Create: `components/brand/proposal-form.tsx`
- Create: `app/(brand)/brand/messages/page.tsx`
- Create: `app/(brand)/brand/messages/[matchId]/page.tsx`

- [ ] **Step 1: Write failing tests**

```tsx
// components/brand/proposal-form.test.tsx
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import ProposalForm from './proposal-form'

describe('ProposalForm', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ id: 'p1', title: 'Deal', status: 'pending' }),
    }))
  })

  it('renders title, pay_amount, and pay_type fields', () => {
    render(<ProposalForm matchId="match-1" onSent={() => {}} />)
    expect(screen.getByLabelText(/title/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/amount/i)).toBeInTheDocument()
  })

  it('shows validation error when required fields are missing', async () => {
    render(<ProposalForm matchId="match-1" onSent={() => {}} />)
    await userEvent.click(screen.getByRole('button', { name: /send proposal/i }))
    expect(await screen.findByText(/title is required/i)).toBeInTheDocument()
  })

  it('calls POST /api/deals/proposals on valid submission', async () => {
    render(<ProposalForm matchId="match-1" onSent={() => {}} />)
    await userEvent.type(screen.getByLabelText(/title/i), 'Summer Deal')
    await userEvent.type(screen.getByLabelText(/amount/i), '5000')
    await userEvent.click(screen.getByRole('button', { name: /send proposal/i }))
    await waitFor(() =>
      expect(fetch).toHaveBeenCalledWith('/api/deals/proposals', expect.objectContaining({ method: 'POST' }))
    )
  })
})
```

- [ ] **Step 2: Run test — verify it fails**

```bash
npm run test -- proposal-form
```

Expected: FAIL — `ProposalForm` not found.

- [ ] **Step 3: Implement ProposalForm**

```tsx
// components/brand/proposal-form.tsx
'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import type { Database } from '@/types/database'

type PayType = Database['public']['Enums']['pay_type']
type ProposalRow = Database['public']['Tables']['proposals']['Row']

const schema = z.object({
  title: z.string().min(1, 'Title is required').max(200),
  pay_amount: z.coerce.number().positive('Amount must be positive'),
  pay_type: z.enum(['flat_fee', 'monthly_retainer', 'per_post', 'revenue_share'] as const),
  pay_currency: z.string().length(3).default('GBP'),
  timeline_start: z.string().optional(),
  timeline_end: z.string().optional(),
})
type FormValues = z.infer<typeof schema>

interface Props {
  matchId: string
  onSent: (proposal: ProposalRow) => void
}

const PAY_TYPE_OPTIONS: { value: PayType; label: string }[] = [
  { value: 'flat_fee', label: 'Flat fee' },
  { value: 'monthly_retainer', label: 'Monthly retainer' },
  { value: 'per_post', label: 'Per post' },
  { value: 'revenue_share', label: 'Revenue share' },
]

export default function ProposalForm({ matchId, onSent }: Props) {
  const [loading, setLoading] = useState(false)
  const form = useForm<FormValues>({ resolver: zodResolver(schema) })

  async function onSubmit(values: FormValues) {
    setLoading(true)
    try {
      const res = await fetch('/api/deals/proposals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ match_id: matchId, ...values }),
      })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error?.message ?? 'Failed to send proposal'); return }
      toast.success('Proposal sent!')
      form.reset()
      onSent(data as ProposalRow)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="border-t pt-4">
      <p className="text-sm font-semibold mb-3">Send a proposal</p>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3">
          <FormField control={form.control} name="title" render={({ field }) => (
            <FormItem>
              <FormLabel>Title</FormLabel>
              <FormControl><Input placeholder="Summer 2026 Endorsement Deal" {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )} />
          <div className="grid grid-cols-2 gap-3">
            <FormField control={form.control} name="pay_amount" render={({ field }) => (
              <FormItem>
                <FormLabel>Amount</FormLabel>
                <FormControl><Input type="number" min={0} placeholder="5000" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="pay_currency" render={({ field }) => (
              <FormItem>
                <FormLabel>Currency</FormLabel>
                <FormControl><Input placeholder="GBP" maxLength={3} {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
          </div>
          <FormField control={form.control} name="pay_type" render={({ field }) => (
            <FormItem>
              <FormLabel>Pay type</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger><SelectValue placeholder="Select pay type" /></SelectTrigger>
                </FormControl>
                <SelectContent>
                  {PAY_TYPE_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )} />
          <div className="grid grid-cols-2 gap-3">
            <FormField control={form.control} name="timeline_start" render={({ field }) => (
              <FormItem>
                <FormLabel>Start date <span className="text-muted-foreground text-xs">(optional)</span></FormLabel>
                <FormControl><Input type="date" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="timeline_end" render={({ field }) => (
              <FormItem>
                <FormLabel>End date <span className="text-muted-foreground text-xs">(optional)</span></FormLabel>
                <FormControl><Input type="date" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
          </div>
          <Button type="submit" disabled={loading}>
            {loading ? 'Sending…' : 'Send proposal'}
          </Button>
        </form>
      </Form>
    </div>
  )
}
```

- [ ] **Step 4: Create messages pages**

```tsx
// app/(brand)/brand/messages/page.tsx
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getUser } from '@/lib/supabase/auth'
import { getMatches } from '@/lib/supabase/messaging'
import MatchList from '@/components/messaging/match-list'
import type { Database } from '@/types/database'

type MatchRow = Database['public']['Tables']['matches']['Row']

export default async function BrandMessagesPage() {
  const supabase = await createClient()
  const user = await getUser(supabase)
  if (!user) redirect('/auth')

  const matches = (await getMatches(supabase, user.id)) as MatchRow[]
  const active = matches.filter((m) => m.status === 'active')

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 space-y-6">
      <h1 className="text-2xl font-bold">Messages</h1>
      <MatchList matches={active} currentUserId={user.id} basePath="/brand/messages" />
    </div>
  )
}
```

```tsx
// app/(brand)/brand/messages/[matchId]/page.tsx
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getUser } from '@/lib/supabase/auth'
import { getMessages } from '@/lib/supabase/messaging'
import { getProposals } from '@/lib/supabase/deals'
import { buttonVariants } from '@/components/ui/button'
import ChatWindow from '@/components/messaging/chat-window'
import ProposalForm from '@/components/brand/proposal-form'
import type { Database } from '@/types/database'

type MessageRow = Database['public']['Tables']['messages']['Row']
type ProposalRow = Database['public']['Tables']['proposals']['Row']

export default async function BrandChatPage({
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
    redirect('/brand/messages')
  }

  return (
    <div className="mx-auto max-w-2xl h-screen flex flex-col">
      <div className="flex items-center gap-3 border-b px-4 py-3">
        <Link href="/brand/messages" className={buttonVariants({ variant: 'ghost', size: 'sm' })}>
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
      <div className="border-t p-4">
        <ProposalForm matchId={matchId} onSent={() => {}} />
      </div>
    </div>
  )
}
```

- [ ] **Step 5: Run tests — verify they pass**

```bash
npm run test -- proposal-form
```

Expected: PASS (3 tests).

- [ ] **Step 6: Commit**

```bash
git add components/brand/proposal-form.tsx components/brand/proposal-form.test.tsx "app/(brand)/brand/messages/page.tsx" "app/(brand)/brand/messages/[matchId]/page.tsx"
git commit -m "feat(brand): messages pages and proposal form with tests"
```

---

## Task 8: Payments page + PaymentForm

**Files:**
- Create: `components/brand/payment-form.tsx`
- Create: `app/(brand)/brand/payments/page.tsx`

- [ ] **Step 1: Create PaymentForm**

```tsx
// components/brand/payment-form.tsx
'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'

const schema = z.object({
  contractId: z.string().min(1, 'Contract ID is required').uuid('Must be a valid contract ID'),
})
type FormValues = z.infer<typeof schema>

export default function PaymentForm() {
  const [loading, setLoading] = useState(false)
  const form = useForm<FormValues>({ resolver: zodResolver(schema) })

  async function onSubmit({ contractId }: FormValues) {
    setLoading(true)
    try {
      const res = await fetch('/api/payments/intents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contractId }),
      })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error?.message ?? 'Failed to initiate payment'); return }
      toast.success('Payment intent created. Proceed to complete payment.')
      form.reset()
    } finally {
      setLoading(false)
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 max-w-md">
        <FormField control={form.control} name="contractId" render={({ field }) => (
          <FormItem>
            <FormLabel>Contract ID</FormLabel>
            <FormControl>
              <Input placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )} />
        <Button type="submit" disabled={loading}>
          {loading ? 'Processing…' : 'Initiate payment'}
        </Button>
      </form>
    </Form>
  )
}
```

- [ ] **Step 2: Create payments page**

```tsx
// app/(brand)/brand/payments/page.tsx
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getUser } from '@/lib/supabase/auth'
import { getPaymentHistory } from '@/lib/supabase/payments'
import PaymentForm from '@/components/brand/payment-form'
import { cn } from '@/lib/utils'
import type { Database } from '@/types/database'

type PaymentRow = Database['public']['Tables']['payments']['Row']

export default async function BrandPaymentsPage() {
  const supabase = await createClient()
  const user = await getUser(supabase)
  if (!user) redirect('/auth')

  const payments = (await getPaymentHistory(supabase, user.id)) as PaymentRow[]

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 space-y-8">
      <h1 className="text-2xl font-bold">Payments</h1>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Initiate a payment</h2>
        <p className="text-sm text-muted-foreground">
          Enter the contract ID from a fully signed deal to initiate a Stripe payment to the athlete or team.
        </p>
        <PaymentForm />
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Payment history</h2>
        {payments.length === 0 ? (
          <p className="text-muted-foreground text-sm">No payments yet.</p>
        ) : (
          <ul className="divide-y rounded-xl border">
            {payments.map((p) => (
              <li key={p.id} className="flex items-center justify-between px-4 py-3">
                <div>
                  <p className="text-sm font-medium font-mono">{p.contract_id.slice(0, 8)}…</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(p.created_at).toLocaleDateString()}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-semibold">{p.currency} {p.amount.toLocaleString()}</p>
                  <span className={cn(
                    'text-xs rounded-full px-2 py-0.5',
                    p.status === 'succeeded' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                    p.status === 'failed' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' :
                    'bg-muted text-muted-foreground'
                  )}>
                    {p.status}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
```

- [ ] **Step 3: Run type-check**

```bash
npm run type-check
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add components/brand/payment-form.tsx "app/(brand)/brand/payments/page.tsx"
git commit -m "feat(brand): payments page with payment history and initiate payment form"
```

---

## Task 9: Settings + BrandSettingsForm + CancelSubscription

**Files:**
- Create: `components/brand/brand-settings-form.test.tsx`
- Create: `components/brand/brand-settings-form.tsx`
- Create: `components/brand/cancel-subscription.tsx`
- Create: `app/(brand)/brand/settings/page.tsx`

- [ ] **Step 1: Write failing tests**

```tsx
// components/brand/brand-settings-form.test.tsx
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import BrandSettingsForm from './brand-settings-form'

describe('BrandSettingsForm', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ id: '1', company_name: 'Acme', status: 'active' }),
    }))
  })

  const baseProfile = {
    id: '1',
    company_name: 'Acme Corp',
    trading_name: '',
    headquarters_city: 'London',
    headquarters_country: 'UK',
    website_url: '',
    linkedin_url: '',
    status: 'active',
  } as never

  it('renders company name field pre-filled', () => {
    render(<BrandSettingsForm profile={baseProfile} />)
    expect(screen.getByDisplayValue('Acme Corp')).toBeInTheDocument()
  })

  it('shows validation error when company_name is cleared', async () => {
    render(<BrandSettingsForm profile={baseProfile} />)
    await userEvent.clear(screen.getByLabelText(/company name/i))
    await userEvent.click(screen.getByRole('button', { name: /save/i }))
    expect(await screen.findByText(/company name is required/i)).toBeInTheDocument()
  })

  it('calls PATCH /api/profiles/me on submit', async () => {
    render(<BrandSettingsForm profile={baseProfile} />)
    await userEvent.click(screen.getByRole('button', { name: /save/i }))
    await waitFor(() =>
      expect(fetch).toHaveBeenCalledWith('/api/profiles/me', expect.objectContaining({ method: 'PATCH' }))
    )
  })
})
```

- [ ] **Step 2: Run test — verify it fails**

```bash
npm run test -- brand-settings-form
```

Expected: FAIL — `BrandSettingsForm` not found.

- [ ] **Step 3: Implement BrandSettingsForm**

```tsx
// components/brand/brand-settings-form.tsx
'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import type { Database } from '@/types/database'

type BrandRow = Database['public']['Tables']['brand_profiles']['Row']

const schema = z.object({
  company_name: z.string().min(1, 'Company name is required').max(100),
  trading_name: z.string().max(100).optional(),
  headquarters_city: z.string().optional(),
  headquarters_country: z.string().optional(),
  website_url: z.string().url('Must be a valid URL').optional().or(z.literal('')),
  linkedin_url: z.string().url('Must be a valid LinkedIn URL').optional().or(z.literal('')),
  description: z.string().max(2000).optional(),
})
type FormValues = z.infer<typeof schema>

interface Props { profile: BrandRow }

export default function BrandSettingsForm({ profile }: Props) {
  const [loading, setLoading] = useState(false)
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      company_name: profile.company_name ?? '',
      trading_name: profile.trading_name ?? '',
      headquarters_city: profile.headquarters_city ?? '',
      headquarters_country: profile.headquarters_country ?? '',
      website_url: profile.website_url ?? '',
      linkedin_url: profile.linkedin_url ?? '',
      description: profile.description ?? '',
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
        <FormField control={form.control} name="company_name" render={({ field }) => (
          <FormItem>
            <FormLabel>Company name</FormLabel>
            <FormControl><Input {...field} /></FormControl>
            <FormMessage />
          </FormItem>
        )} />
        <FormField control={form.control} name="trading_name" render={({ field }) => (
          <FormItem>
            <FormLabel>Trading name <span className="text-muted-foreground text-xs">(optional)</span></FormLabel>
            <FormControl><Input {...field} /></FormControl>
            <FormMessage />
          </FormItem>
        )} />
        <div className="grid grid-cols-2 gap-4">
          <FormField control={form.control} name="headquarters_city" render={({ field }) => (
            <FormItem>
              <FormLabel>City</FormLabel>
              <FormControl><Input {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )} />
          <FormField control={form.control} name="headquarters_country" render={({ field }) => (
            <FormItem>
              <FormLabel>Country</FormLabel>
              <FormControl><Input {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )} />
        </div>
        <FormField control={form.control} name="website_url" render={({ field }) => (
          <FormItem>
            <FormLabel>Website <span className="text-muted-foreground text-xs">(optional)</span></FormLabel>
            <FormControl><Input type="url" {...field} /></FormControl>
            <FormMessage />
          </FormItem>
        )} />
        <FormField control={form.control} name="linkedin_url" render={({ field }) => (
          <FormItem>
            <FormLabel>LinkedIn <span className="text-muted-foreground text-xs">(optional)</span></FormLabel>
            <FormControl><Input type="url" {...field} /></FormControl>
            <FormMessage />
          </FormItem>
        )} />
        <FormField control={form.control} name="description" render={({ field }) => (
          <FormItem>
            <FormLabel>About your brand <span className="text-muted-foreground text-xs">(optional)</span></FormLabel>
            <FormControl>
              <Textarea rows={4} className="resize-none" {...field} />
            </FormControl>
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

- [ ] **Step 4: Implement CancelSubscription**

```tsx
// components/brand/cancel-subscription.tsx
'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'

export default function CancelSubscription() {
  const [confirming, setConfirming] = useState(false)
  const [loading, setLoading] = useState(false)

  async function handleCancel() {
    setLoading(true)
    try {
      const res = await fetch('/api/payments/subscriptions/cancel', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error?.message ?? 'Failed to cancel'); return }
      toast.success('Subscription will cancel at the end of the billing period.')
      setConfirming(false)
    } finally {
      setLoading(false)
    }
  }

  if (!confirming) {
    return (
      <Button variant="destructive" onClick={() => setConfirming(true)}>
        Cancel subscription
      </Button>
    )
  }

  return (
    <div className="rounded-xl border border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-900/20 p-4 space-y-3">
      <p className="text-sm font-medium text-red-800 dark:text-red-200">
        Are you sure? You will lose access to brand features at the end of the billing period.
      </p>
      <div className="flex gap-2">
        <Button variant="destructive" size="sm" onClick={handleCancel} disabled={loading}>
          {loading ? 'Cancelling…' : 'Yes, cancel my subscription'}
        </Button>
        <Button variant="outline" size="sm" onClick={() => setConfirming(false)}>
          Keep subscription
        </Button>
      </div>
    </div>
  )
}
```

- [ ] **Step 5: Create settings page**

```tsx
// app/(brand)/brand/settings/page.tsx
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getUser } from '@/lib/supabase/auth'
import { getOwnProfile } from '@/lib/supabase/profiles'
import { getSubscriptionForUser } from '@/lib/supabase/payments'
import BrandSettingsForm from '@/components/brand/brand-settings-form'
import CancelSubscription from '@/components/brand/cancel-subscription'
import type { Database } from '@/types/database'

type BrandRow = Database['public']['Tables']['brand_profiles']['Row']
type SubscriptionRow = Database['public']['Tables']['subscriptions']['Row']

export default async function BrandSettingsPage() {
  const supabase = await createClient()
  const user = await getUser(supabase)
  if (!user) redirect('/auth')

  const [profile, subscription] = await Promise.all([
    getOwnProfile(supabase, user.id, 'brand') as Promise<BrandRow | null>,
    getSubscriptionForUser(supabase, user.id) as Promise<SubscriptionRow | null>,
  ])

  if (!profile) redirect('/brand/onboarding')

  const hasActiveSubscription = subscription && ['active', 'trialing'].includes(subscription.status) && !subscription.cancellation_scheduled_at

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 space-y-10">
      <h1 className="text-2xl font-bold">Settings</h1>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Company details</h2>
        <BrandSettingsForm profile={profile} />
      </section>

      {hasActiveSubscription && (
        <section className="space-y-4">
          <h2 className="text-lg font-semibold">Subscription</h2>
          <p className="text-sm text-muted-foreground">
            You are on Tier {subscription!.tier}. Your subscription renews on{' '}
            {new Date(subscription!.current_period_end).toLocaleDateString()}.
          </p>
          <CancelSubscription />
        </section>
      )}
    </div>
  )
}
```

- [ ] **Step 6: Run tests — verify they pass**

```bash
npm run test -- brand-settings-form
```

Expected: PASS (3 tests).

- [ ] **Step 7: Commit**

```bash
git add components/brand/brand-settings-form.tsx components/brand/brand-settings-form.test.tsx components/brand/cancel-subscription.tsx "app/(brand)/brand/settings/page.tsx"
git commit -m "feat(brand): settings page, brand settings form with tests, cancel subscription"
```

---

## Task 10: E2E spec + final check

**Files:**
- Create: `e2e/brand.spec.ts`

- [ ] **Step 1: Write Playwright brand flow spec**

```ts
// e2e/brand.spec.ts
import { test, expect } from '@playwright/test'

test.describe('Brand flows', () => {
  test('brand onboarding step 1 redirects unauthenticated user to /auth', async ({ page }) => {
    await page.goto('/brand/onboarding/step/1')
    await expect(page).toHaveURL(/\/auth/)
  })

  test('brand dashboard redirects unauthenticated user to /auth', async ({ page }) => {
    await page.goto('/brand/dashboard')
    await expect(page).toHaveURL(/\/auth/)
  })

  test('brand discover redirects unauthenticated user to /auth', async ({ page }) => {
    await page.goto('/brand/discover')
    await expect(page).toHaveURL(/\/auth/)
  })

  test('brand listings redirects unauthenticated user to /auth', async ({ page }) => {
    await page.goto('/brand/listings')
    await expect(page).toHaveURL(/\/auth/)
  })

  test('brand subscription redirects unauthenticated user to /auth', async ({ page }) => {
    await page.goto('/brand/subscription')
    await expect(page).toHaveURL(/\/auth/)
  })

  test('/dashboard redirects unauthenticated user to /auth', async ({ page }) => {
    await page.goto('/dashboard')
    await expect(page).toHaveURL(/\/auth/)
  })
})
```

- [ ] **Step 2: Commit E2E spec**

```bash
git add e2e/brand.spec.ts
git commit -m "test(e2e): brand flow Playwright spec"
```

- [ ] **Step 3: Run full check**

```bash
npm run check
```

Expected: type-check clean, lint clean (warnings only, no errors), all Vitest tests passing.

- [ ] **Step 4: Fix any lint or type errors then commit**

```bash
git add -A
git commit -m "fix(brand): type and lint corrections"
```

---

## Self-Review

**Spec coverage:**

| Requirement | Task |
|---|---|
| `app/(brand)/layout.tsx` — auth guard | Task 1 |
| `app/(brand)/brand/onboarding/page.tsx` | Task 1 |
| `components/brand/brand-profile-form.tsx` | Task 2 |
| `app/(brand)/brand/subscription/page.tsx` | Task 3 |
| `components/brand/subscription-tiers.tsx` | Task 3 |
| `app/(brand)/brand/dashboard/page.tsx` | Task 4 |
| `app/(brand)/brand/discover/page.tsx` | Task 5 |
| `app/(brand)/brand/listings/page.tsx` | Task 6 |
| `app/(brand)/brand/listings/new/page.tsx` | Task 6 |
| `components/brand/listing-form.tsx` | Task 6 |
| `app/(brand)/brand/listings/[id]/page.tsx` | Task 6 |
| `app/(brand)/brand/messages/page.tsx` | Task 7 |
| `app/(brand)/brand/messages/[matchId]/page.tsx` | Task 7 |
| `components/brand/proposal-form.tsx` | Task 7 |
| `app/(brand)/brand/payments/page.tsx` | Task 8 |
| `components/brand/payment-form.tsx` | Task 8 |
| `app/(brand)/brand/settings/page.tsx` | Task 9 |
| `components/brand/cancel-subscription.tsx` | Task 9 |
| `lib/supabase/profiles.ts` — getActiveAthleteProfiles | Task 1 |

**No placeholders found.**

**Type consistency:**
- `BrandRow` from `Database['public']['Tables']['brand_profiles']['Row']` — used consistently across all files
- `getActiveAthleteProfiles()` added in Task 1, consumed in Task 5
- `getSubscriptionForUser()` imported from `@/lib/supabase/payments` in Tasks 3, 4, 9 — consistent
- `SubscriptionRow` type alias used identically across Tasks 3, 4, 9
