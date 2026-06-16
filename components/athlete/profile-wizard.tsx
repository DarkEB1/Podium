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
  level: z
    .enum([
      'recreational',
      'amateur',
      'semi_professional',
      'professional',
      'international',
      'university_bucs',
      'academy',
      'national',
    ] as const)
    .optional(),
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
