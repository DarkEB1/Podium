'use client'

import { useId, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Info, ShieldCheck } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { VerifiedBadge } from '@/components/ui/status-badges'
import { cn } from '@/lib/utils'
import type { Database } from '@/types/database'

type AgentRow = Database['public']['Tables']['agent_profiles']['Row']
type VerificationStatus = Database['public']['Enums']['agent_verification_status']

const BIO_MAX = 1000

// commission_rate is a numeric percentage (0–100). It is informational only and
// never enforced by Podium (spec §6A.2), so it is always optional.
const profileSchema = z.object({
  agent_full_name: z.string().max(120).optional().or(z.literal('')),
  agency_name: z.string().max(120).optional().or(z.literal('')),
  commission_rate: z
    .union([z.coerce.number().min(0, 'Must be 0 or more').max(100, 'Must be 100 or less'), z.nan()])
    .optional(),
  bio: z.string().max(BIO_MAX).optional().or(z.literal('')),
})

type ProfileValues = z.infer<typeof profileSchema>

/**
 * InfoTooltip — lightweight, accessible informational disclosure. No tooltip
 * primitive exists in `components/ui/` (Track A), and this pod may not add one,
 * so AG1 ships a self-contained click-to-toggle popover used only here. The
 * trigger is keyboard-focusable and labelled; the content is associated via
 * `aria-describedby` and dismissed by toggling or Escape.
 */
function InfoTooltip({ label, children }: { label: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false)
  const id = useId()

  return (
    <span className="relative inline-flex">
      <button
        type="button"
        aria-label={label}
        aria-expanded={open}
        aria-describedby={open ? id : undefined}
        onClick={() => setOpen((v) => !v)}
        onKeyDown={(e) => {
          if (e.key === 'Escape') setOpen(false)
        }}
        className="inline-flex size-5 items-center justify-center rounded-full text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
      >
        <Info aria-hidden="true" className="size-4" />
      </button>
      {open ? (
        <span
          id={id}
          role="note"
          className="absolute left-0 top-6 z-10 w-64 rounded-2xl border border-border bg-card p-4 text-small text-muted-foreground shadow-card"
        >
          {children}
        </span>
      ) : null}
    </span>
  )
}

function verificationLabel(status: VerificationStatus): string {
  if (status === 'verified') return 'Your agency is verified by Podium.'
  if (status === 'pending') return 'Your verification request is under review.'
  return 'Verify your agency to build trust with athletes and brands.'
}

interface Props {
  profile: AgentRow
  /** B9 `applyForVerification`, bound to the current agent on the server. */
  onApplyForVerification: (agentId: string) => Promise<unknown>
}

export default function AgentProfileForm({ profile, onApplyForVerification }: Props) {
  const router = useRouter()
  const [status, setStatus] = useState<VerificationStatus>(profile.verification_status)
  const [applying, setApplying] = useState(false)
  const [saving, setSaving] = useState(false)

  const form = useForm<ProfileValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      agent_full_name: profile.agent_full_name ?? '',
      agency_name: profile.agency_name ?? '',
      commission_rate: profile.commission_rate ?? undefined,
      bio: profile.bio ?? '',
    },
  })

  async function handleApply() {
    setApplying(true)
    try {
      await onApplyForVerification(profile.id)
      setStatus('pending')
      toast.success('Verification requested. We will review your agency shortly.')
      router.refresh()
    } catch {
      toast.error('Could not submit your verification request. Please try again.')
    } finally {
      setApplying(false)
    }
  }

  async function onSubmit(values: ProfileValues) {
    setSaving(true)
    try {
      const commission =
        typeof values.commission_rate === 'number' && !Number.isNaN(values.commission_rate)
          ? values.commission_rate
          : null
      const res = await fetch('/api/profiles/me', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agent_full_name: values.agent_full_name || null,
          agency_name: values.agency_name || null,
          commission_rate: commission,
          bio: values.bio || null,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error?.message ?? 'Failed to save')
        return
      }
      toast.success('Profile saved.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-8">
      {/* Verification — the badge state and the apply CTA are the page's most
          prominent element (spec §6A.1). */}
      <section
        aria-labelledby="verification-heading"
        className="rounded-2xl border border-border bg-card p-6 shadow-sm md:p-8"
      >
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <ShieldCheck aria-hidden="true" className="size-5 text-muted-foreground" />
              <h2 id="verification-heading" className="font-heading text-large">
                Verification
              </h2>
            </div>
            <div className="flex items-center gap-3">
              <VerifiedBadge verified={status === 'verified'} />
            </div>
            <p className="max-w-md text-medium text-muted-foreground">
              {verificationLabel(status)}
            </p>
          </div>
          {status === 'unverified' ? (
            <Button type="button" onClick={handleApply} disabled={applying}>
              {applying ? 'Submitting…' : 'Apply for Verification'}
            </Button>
          ) : null}
        </div>
      </section>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <FormField
            control={form.control}
            name="agent_full_name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Your name</FormLabel>
                <FormControl>
                  <Input placeholder="Jordan Avery" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="agency_name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Agency name</FormLabel>
                <FormControl>
                  <Input placeholder="Avery Sports Management" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Commission rate — informational only, with an explanatory tooltip
              and an athlete-facing disclosure (spec §6A.2). */}
          <FormField
            control={form.control}
            name="commission_rate"
            render={({ field }) => (
              <FormItem>
                <div className="flex items-center gap-1.5">
                  <FormLabel>Commission rate (%)</FormLabel>
                  <InfoTooltip label="About commission rate">
                    This is informational only. Podium displays it on your profile
                    but does not calculate, collect, or enforce commission.
                  </InfoTooltip>
                </div>
                <FormControl>
                  <Input
                    type="number"
                    inputMode="decimal"
                    min={0}
                    max={100}
                    step={0.5}
                    placeholder="e.g. 15"
                    value={field.value ?? ''}
                    onChange={(e) =>
                      field.onChange(e.target.value === '' ? undefined : e.target.valueAsNumber)
                    }
                    name={field.name}
                    onBlur={field.onBlur}
                    ref={field.ref}
                  />
                </FormControl>
                <p className="text-small text-muted-foreground">
                  Commission is agreed privately between you and your client and is
                  not enforced by Podium.
                </p>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="bio"
            render={({ field }) => (
              <FormItem>
                <FormLabel>About your agency</FormLabel>
                <FormControl>
                  <Textarea
                    rows={5}
                    maxLength={BIO_MAX}
                    className="resize-none"
                    placeholder="Tell athletes about your agency, the clients you represent, and how you work…"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <Button type="submit" className={cn('w-full')} disabled={saving}>
            {saving ? 'Saving…' : 'Save profile'}
          </Button>
        </form>
      </Form>
    </div>
  )
}
