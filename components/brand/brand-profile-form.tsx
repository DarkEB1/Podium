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
})

type Step1Values = z.infer<typeof step1Schema>
type Step2Values = z.infer<typeof step2Schema>
type Step3Values = z.infer<typeof step3Schema>

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

function Step1({ profile, onSaved }: { profile: BrandRow | null; onSaved: (p: BrandRow) => void }) {
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

function Step2({ profile, onSaved }: { profile: BrandRow | null; onSaved: (p: BrandRow) => void }) {
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

function Step3({ profile, onSaved }: { profile: BrandRow | null; onSaved: (p: BrandRow) => void }) {
  const [loading, setLoading] = useState(false)
  const form = useForm<Step3Values>({
    resolver: zodResolver(step3Schema),
    defaultValues: {
      description: profile?.description ?? '',
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
        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? 'Saving…' : 'Next →'}
        </Button>
      </form>
    </Form>
  )
}

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
