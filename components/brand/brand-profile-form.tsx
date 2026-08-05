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
import { ImageUpload } from '@/components/ui/image-upload'
import { CardSelectGroup } from '@/components/ui/card-select'
import { CharacterCounter } from '@/components/ui/character-counter'
import { MarketplaceCard } from '@/components/ui/marketplace-card'
import {
  Award,
  Users,
  Megaphone,
  Share2,
  CalendarDays,
  Package,
  Trophy,
  Dumbbell,
  Goal,
  CircleDot,
  Flag,
  Waves,
  Bike,
  type LucideIcon,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { ROUTES } from '@/lib/routes'
import type { Database } from '@/types/database'

type BrandRow = Database['public']['Tables']['brand_profiles']['Row']
type BrandIndustry = Database['public']['Enums']['brand_industry']

const DESCRIPTION_MAX = 2000
const MAX_TARGET_SPORTS = 5

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
  industry_other: z.string().max(100).optional(),
  target_level: z.string().optional(),
  geographic_preference: z.string().optional(),
})

const step3Schema = z.object({
  description: z.string().max(DESCRIPTION_MAX).optional(),
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

const SEEKING_OPTIONS: { value: string; label: string; description: string; icon: LucideIcon }[] = [
  { value: 'endorsement', label: 'Endorsement', description: 'Athletes who endorse your products', icon: Award },
  { value: 'team_sponsorship', label: 'Team Sponsorship', description: 'Sponsor a club or squad', icon: Users },
  { value: 'ambassador', label: 'Brand Ambassador', description: 'Long-term brand partners', icon: Megaphone },
  { value: 'social_media', label: 'Social Media', description: 'Posts and content campaigns', icon: Share2 },
  { value: 'event_appearance', label: 'Event Appearance', description: 'Appearances and meet-and-greets', icon: CalendarDays },
  { value: 'product_deal', label: 'Product Deal', description: 'Gifted or discounted products', icon: Package },
]

const TARGET_SPORTS: { name: string; icon: LucideIcon }[] = [
  { name: 'Football', icon: Goal },
  { name: 'Athletics', icon: Trophy },
  { name: 'Tennis', icon: CircleDot },
  { name: 'Basketball', icon: CircleDot },
  { name: 'Rugby', icon: Goal },
  { name: 'Cricket', icon: CircleDot },
  { name: 'Cycling', icon: Bike },
  { name: 'Swimming', icon: Waves },
  { name: 'Golf', icon: Flag },
  { name: 'Boxing', icon: Dumbbell },
  { name: 'MMA', icon: Dumbbell },
  { name: 'Other', icon: Flag },
]

function stepLabel(step: number): string {
  return { 1: 'Company Basics', 2: 'Targeting', 3: 'About', 4: 'Review' }[step] ?? ''
}

/** Anything the profile API can return: the saved row, or an error envelope. */
type ApiPayload = Record<string, unknown> & { error?: { message?: string } }

/**
 * Reads a response body without assuming it is JSON.
 *
 * A route handler that throws returns an empty, non-JSON body, and
 * `res.json()` on that throws a SyntaxError before the `res.ok` check can run.
 * The caller's try/finally then swallowed it, which is why a failed save showed
 * "Saving…" and silently reverted with no error message of any kind.
 */
async function readJson(res: Response): Promise<ApiPayload> {
  return (await res.json().catch(() => ({}))) as ApiPayload
}

function Step1({ profile, onSaved }: { profile: BrandRow | null; onSaved: (p: BrandRow) => void }) {
  const [loading, setLoading] = useState(false)
  const [logoUrl, setLogoUrl] = useState<string | null>(profile?.logo_url ?? null)
  const [coverUrl, setCoverUrl] = useState<string | null>(profile?.cover_image_url ?? null)
  const [coverError, setCoverError] = useState(false)
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

  const companyName = form.watch('company_name')

  async function onSubmit(values: Step1Values) {
    if (!coverUrl) {
      setCoverError(true)
      return
    }
    setCoverError(false)
    setLoading(true)
    try {
      const method = profile?.id ? 'PATCH' : 'POST'
      const res = await fetch(ROUTES.api.profiles.me, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...values, logo_url: logoUrl, cover_image_url: coverUrl }),
      })
      const data = await readJson(res)
      if (!res.ok) {
        toast.error(data.error?.message ?? 'Could not save your details. Please try again.')
        return
      }
      onSaved(data as unknown as BrandRow)
    } catch {
      toast.error('Could not save your details. Please check your connection and try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        {/* Logo — prominent at the top, with a live discovery-card preview. */}
        <div className="space-y-3 rounded-xl border bg-muted/20 p-4">
          <ImageUpload
            value={logoUrl}
            onUploaded={setLogoUrl}
            aspect={1}
            shape="square"
            label="Company logo"
            subtext="Square image, at least 500px. Shown across the marketplace."
          />
          <div>
            <p className="text-small font-medium text-muted-foreground">How you&apos;ll appear in discovery</p>
            <div className="mt-2 max-w-[15rem]">
              <MarketplaceCard
                image={coverUrl ?? logoUrl ?? '/placeholder-cover.svg'}
                imageAlt={`${companyName || 'Your brand'} preview`}
                title={companyName || 'Your brand'}
                subtitle={profile?.industry ? profile.industry.replace('_', ' ') : 'Brand'}
                cta={{ label: 'View brand' }}
              />
            </div>
          </div>
        </div>

        {/* Cover image — mandatory. */}
        <ImageUpload
          value={coverUrl}
          onUploaded={(url) => { setCoverUrl(url); setCoverError(false) }}
          aspect={16 / 9}
          shape="square"
          required
          label="Cover image"
          subtext="Wide banner shown on your brand page and discovery card (required)."
        />
        {coverError ? (
          <p role="alert" className="text-small text-destructive">Cover image is required to continue.</p>
        ) : null}

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
  const [sportError, setSportError] = useState(false)
  const form = useForm<Step2Values>({
    resolver: zodResolver(step2Schema),
    defaultValues: {
      industry: (profile?.industry as BrandIndustry | undefined) ?? undefined,
      industry_other: '',
      target_level: profile?.target_level ?? '',
      geographic_preference: profile?.geographic_preference ?? '',
    },
  })

  const industry = form.watch('industry')

  function toggleSport(name: string) {
    if (targetSports.includes(name)) {
      setSportError(false)
      setTargetSports(targetSports.filter((s) => s !== name))
      return
    }
    if (targetSports.length >= MAX_TARGET_SPORTS) {
      setSportError(true)
      return
    }
    setSportError(false)
    setTargetSports([...targetSports, name])
  }

  async function onSubmit(values: Step2Values) {
    setLoading(true)
    try {
      // industry_other only means anything for the "other" industry, and the
      // key is OMITTED otherwise rather than nulled. Migrations are applied
      // ahead of the code that needs them but the two are separate steps, and
      // sending a column that does not exist yet makes PostgREST reject the
      // whole PATCH (PGRST204) — which would fail step 2 for every brand, not
      // just the ones this field is for. Omitting leaves a stale answer on the
      // row after switching industry; nothing renders it unless the industry is
      // 'other' again.
      const { industry_other, ...rest } = values
      const payload = {
        ...rest,
        ...(values.industry === 'other' ? { industry_other: industry_other ?? '' } : {}),
        seeking,
        target_sports: targetSports,
      }
      const res = await fetch(ROUTES.api.profiles.me, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await readJson(res)
      if (!res.ok) {
        toast.error(data.error?.message ?? 'Could not save your targeting. Please try again.')
        return
      }
      // as unknown as BrandRow: a 2xx body from this endpoint is the saved row.
      onSaved(data as unknown as BrandRow)
    } catch {
      toast.error('Could not save your targeting. Please check your connection and try again.')
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
            {/* base-ui renders the raw value in the collapsed trigger unless the
                root is given the value→label map. */}
            <Select items={INDUSTRY_OPTIONS} onValueChange={field.onChange} defaultValue={field.value}>
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
        {industry === 'other' ? (
          <FormField control={form.control} name="industry_other" render={({ field }) => (
            <FormItem>
              <FormLabel>Please specify your industry</FormLabel>
              <FormControl><Input placeholder="e.g. Renewable energy" {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )} />
        ) : null}
        <div>
          <p className="mb-2 text-sm font-medium">What your brand is looking for</p>
          <CardSelectGroup
            multiple
            options={SEEKING_OPTIONS.map((o) => ({
              value: o.value,
              label: o.label,
              description: o.description,
              icon: <o.icon aria-hidden="true" className="size-5" />,
            }))}
            value={seeking}
            onChange={setSeeking}
          />
        </div>
        <div>
          <p className="mb-2 text-sm font-medium">
            Target sports <span className="text-muted-foreground text-xs">(up to {MAX_TARGET_SPORTS})</span>
          </p>
          <div className="flex flex-wrap gap-2">
            {TARGET_SPORTS.map((s) => {
              const Icon = s.icon
              const active = targetSports.includes(s.name)
              return (
                <button
                  key={s.name}
                  type="button"
                  aria-pressed={active}
                  onClick={() => toggleSport(s.name)}
                  className={cn(
                    'flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm transition-colors',
                    'focus-visible:ring-3 focus-visible:ring-ring/50 outline-none',
                    active
                      ? 'border-primary bg-primary/10 text-foreground'
                      : 'border-border hover:border-foreground/50'
                  )}
                >
                  <Icon aria-hidden="true" className="size-4" />
                  {s.name}
                </button>
              )
            })}
          </div>
          {sportError ? (
            <p role="alert" className="mt-2 text-small text-destructive">
              You can select a maximum of {MAX_TARGET_SPORTS} sports.
            </p>
          ) : null}
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

  const description = form.watch('description') ?? ''

  async function onSubmit(values: Step3Values) {
    setLoading(true)
    try {
      const res = await fetch(ROUTES.api.profiles.me, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      })
      const data = await readJson(res)
      if (!res.ok) {
        toast.error(data.error?.message ?? 'Could not save your description. Please try again.')
        return
      }
      // as unknown as BrandRow: a 2xx body from this endpoint is the saved row.
      onSaved(data as unknown as BrandRow)
    } catch {
      toast.error('Could not save your description. Please check your connection and try again.')
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
                maxLength={DESCRIPTION_MAX}
                className="resize-none"
                {...field}
              />
            </FormControl>
            <div className="flex items-start justify-between gap-4">
              <p className="text-small text-muted-foreground">
                Keep it concise, and lead with what makes your brand a great partner.
              </p>
              <CharacterCounter value={description} max={DESCRIPTION_MAX} />
            </div>
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
  const [loading, setLoading] = useState(false)

  /**
   * This used to fire a success toast and navigate, without telling the server
   * anything. Nothing recorded that the wizard had been finished, so the
   * onboarding gate had nothing to read and fell back to `status`, which for a
   * brand is never 'draft' and so always read as "finished" from step 1 onwards.
   */
  async function handleSubmit() {
    setLoading(true)
    try {
      const res = await fetch(ROUTES.api.profiles.onboardingComplete, { method: 'POST' })
      const data = await readJson(res)
      if (!res.ok) {
        toast.error(data.error?.message ?? 'Could not submit your profile. Please try again.')
        return
      }
      toast.success('Profile submitted for review. You will be notified when approved.')
      router.push(ROUTES.brand.subscription)
    } catch {
      toast.error('Could not submit your profile. Please check your connection and try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="rounded-xl border bg-muted/30 p-4 space-y-2">
        <p className="text-sm font-semibold">Profile summary</p>
        <dl className="space-y-1 text-sm">
          <div className="flex gap-2">
            <dt className="text-muted-foreground w-40">Company</dt>
            <dd>{profile?.company_name ?? 'Not set'}</dd>
          </div>
          <div className="flex gap-2">
            <dt className="text-muted-foreground w-40">Industry</dt>
            <dd>{profile?.industry?.replace('_', ' ') ?? 'Not set'}</dd>
          </div>
          <div className="flex gap-2">
            <dt className="text-muted-foreground w-40">Location</dt>
            <dd>{[profile?.headquarters_city, profile?.headquarters_country].filter(Boolean).join(', ') || 'Not set'}</dd>
          </div>
          <div className="flex gap-2">
            <dt className="text-muted-foreground w-40">Website</dt>
            <dd>{profile?.website_url ?? 'Not set'}</dd>
          </div>
        </dl>
      </div>
      <p className="text-xs text-muted-foreground">
        Your profile will be reviewed by the Podium team. Meanwhile, set up your subscription to start discovering athletes and teams.
      </p>
      <Button className="w-full" onClick={handleSubmit} disabled={loading}>
        {loading ? 'Submitting…' : 'Submit for review →'}
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
          <span>Step {step} of {TOTAL_STEPS}: {stepLabel(step)}</span>
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
