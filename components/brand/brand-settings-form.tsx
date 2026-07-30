'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { Button, buttonVariants } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import StatStrip from '@/components/layout/stat-strip'
import { cn } from '@/lib/utils'
import type { Database } from '@/types/database'
import type { BillingHistoryItem } from '@/lib/supabase/payments'

type BrandRow = Database['public']['Tables']['brand_profiles']['Row']
type SubscriptionRow = Database['public']['Tables']['subscriptions']['Row']

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

/** Campaign performance summary counts (spec §4C.1). */
export interface CampaignStats {
  listings: number
  matches: number
  proposals: number
  deals: number
}

/** Minimal subscription shape the settings UI needs. */
export type SettingsSubscription = Pick<
  SubscriptionRow,
  'tier' | 'status' | 'seats_total' | 'seats_used' | 'current_period_end'
>

interface Props {
  profile: BrandRow
  stats?: CampaignStats
  subscription?: SettingsSubscription | null
  billing?: BillingHistoryItem[]
}

// Tier catalogue mirrors the public pricing (BR2). Prices in whole GBP/month.
const TIER_CATALOGUE: { tier: number; name: string; price: number }[] = [
  { tier: 1, name: 'Tier 1', price: 99 },
  { tier: 2, name: 'Tier 2', price: 249 },
  { tier: 3, name: 'Tier 3', price: 599 },
]

function formatGBP(pence: number): string {
  return `£${(pence / 100).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

const PAYMENT_STATUS_LABEL: Record<BillingHistoryItem['status'], string> = {
  pending: 'Pending',
  processing: 'Processing',
  succeeded: 'Paid',
  failed: 'Failed',
  refunded: 'Refunded',
}

export default function BrandSettingsForm({ profile, stats, subscription, billing }: Props) {
  const [loading, setLoading] = useState(false)
  const [confirmRemoveSeat, setConfirmRemoveSeat] = useState(false)
  const [removingSeat, setRemovingSeat] = useState(false)
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
    } catch {
      toast.error('Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  async function handleRemoveSeat() {
    setRemovingSeat(true)
    try {
      const res = await fetch('/api/brand/seats', { method: 'DELETE' })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error?.message ?? 'Failed to remove seat'); return }
      toast.success('Seat removed')
    } catch {
      toast.error('Something went wrong. Please try again.')
    } finally {
      setRemovingSeat(false)
      setConfirmRemoveSeat(false)
    }
  }

  const isPastDue = subscription?.status === 'past_due'
  const currentTier = subscription ? TIER_CATALOGUE.find((t) => t.tier === subscription.tier) : undefined

  return (
    <div className="space-y-8">
      {/* Persistent failed-payment banner (spec §4C.1) */}
      {isPastDue && (
        <div
          role="alert"
          className="flex flex-col gap-3 rounded-2xl border border-destructive/40 bg-destructive/10 p-6 sm:flex-row sm:items-center sm:justify-between"
        >
          <div>
            <p className="font-medium text-destructive">Your last payment failed</p>
            <p className="text-small text-muted-foreground">
              Update your payment method to keep your subscription active.
            </p>
          </div>
          <Link
            href="/brand/subscription/payment"
            className={cn(buttonVariants({ variant: 'default', size: 'sm' }))}
          >
            Update Payment Method
          </Link>
        </div>
      )}

      {/* Campaign performance summary (spec §4C.1) */}
      {stats && (
        <section aria-labelledby="campaign-stats-heading" className="space-y-3">
          <h2 id="campaign-stats-heading" className="font-heading text-large font-semibold text-foreground">
            Campaign performance
          </h2>
          <StatStrip
            stats={[
              { label: 'Active listings', value: String(stats.listings) },
              { label: 'Matches', value: String(stats.matches) },
              { label: 'Proposals', value: String(stats.proposals) },
              { label: 'Deals', value: String(stats.deals) },
            ]}
          />
        </section>
      )}

      {/* Company profile form */}
      <section aria-labelledby="company-heading" className="space-y-4">
        <h2 id="company-heading" className="font-heading text-large font-semibold text-foreground">
          Company details
        </h2>
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
                <FormLabel>Trading name <span className="text-muted-foreground text-small">(optional)</span></FormLabel>
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
                <FormLabel>Website <span className="text-muted-foreground text-small">(optional)</span></FormLabel>
                <FormControl><Input type="url" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="linkedin_url" render={({ field }) => (
              <FormItem>
                <FormLabel>LinkedIn <span className="text-muted-foreground text-small">(optional)</span></FormLabel>
                <FormControl><Input type="url" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="description" render={({ field }) => (
              <FormItem>
                <FormLabel>About your brand <span className="text-muted-foreground text-small">(optional)</span></FormLabel>
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
      </section>

      {/* Subscription, seats & upgrade/downgrade (spec §4C.1) */}
      {subscription && (
        <section aria-labelledby="subscription-heading" className="space-y-4">
          <h2 id="subscription-heading" className="font-heading text-large font-semibold text-foreground">
            Subscription &amp; seats
          </h2>

          <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
            <p className="text-medium text-foreground">
              Current plan: <span className="font-semibold">{currentTier?.name ?? `Tier ${subscription.tier}`}</span>
              {currentTier ? <span className="text-muted-foreground"> · £{currentTier.price}/mo</span> : null}
            </p>

            {/* Seat usage */}
            <p className="mt-2 text-small text-muted-foreground">
              Seats: <span className="font-medium text-foreground">{subscription.seats_used} of {subscription.seats_total} used</span>
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {!confirmRemoveSeat ? (
                <Button
                  variant="outline"
                  size="sm"
                  disabled={subscription.seats_used === 0}
                  onClick={() => setConfirmRemoveSeat(true)}
                >
                  Remove seat
                </Button>
              ) : (
                <span className="flex items-center gap-2 text-small text-muted-foreground">
                  Release one seat?
                  <Button variant="destructive" size="sm" disabled={removingSeat} onClick={handleRemoveSeat}>
                    Confirm remove
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setConfirmRemoveSeat(false)}>
                    Cancel
                  </Button>
                </span>
              )}
            </div>
          </div>

          {/* Upgrade / downgrade options with effective date + price difference */}
          <div className="space-y-2">
            <p className="text-medium font-medium text-foreground">Change plan</p>
            <p className="text-small text-muted-foreground">
              Changes take effect on your next billing date,{' '}
              <span className="font-medium text-foreground">
                effective {formatDate(subscription.current_period_end)}
              </span>
              .
            </p>
            <ul className="divide-y divide-border rounded-2xl border border-border bg-card shadow-sm">
              {TIER_CATALOGUE.filter((t) => t.tier !== subscription.tier).map((t) => {
                const diff = t.price - (currentTier?.price ?? 0)
                const isUpgrade = diff > 0
                return (
                  <li key={t.tier} className="flex items-center justify-between px-6 py-4">
                    <div>
                      <p className="font-medium text-foreground">
                        {isUpgrade ? 'Upgrade' : 'Downgrade'} to {t.name}
                      </p>
                      <p className="text-small text-muted-foreground">
                        £{t.price}/mo ·{' '}
                        <span className="font-medium text-foreground">
                          {diff >= 0 ? `+£${diff}` : `-£${Math.abs(diff)}`}/mo
                        </span>
                      </p>
                    </div>
                    <Link
                      href={`/brand/subscription?change=${t.tier}`}
                      className={cn(buttonVariants({ variant: 'outline', size: 'sm' }))}
                    >
                      {isUpgrade ? 'Upgrade' : 'Downgrade'}
                    </Link>
                  </li>
                )
              })}
            </ul>
          </div>
        </section>
      )}

      {/* Billing history with downloadable PDF invoices (spec §4C.1) */}
      {billing && (
        <section aria-labelledby="billing-heading" className="space-y-3">
          <h2 id="billing-heading" className="font-heading text-large font-semibold text-foreground">
            Billing history
          </h2>
          {billing.length === 0 ? (
            <p className="text-small text-muted-foreground">No invoices yet.</p>
          ) : (
            <ul className="divide-y divide-border rounded-2xl border border-border bg-card shadow-sm">
              {billing.map((item) => (
                <li key={item.id} className="flex items-center justify-between px-6 py-4">
                  <div>
                    <p className="font-medium text-foreground">{formatGBP(item.amount)} {item.currency}</p>
                    <p className="text-small text-muted-foreground">
                      {formatDate(item.created_at)} · {PAYMENT_STATUS_LABEL[item.status]}
                    </p>
                  </div>
                  {item.receipt_url ? (
                    <a
                      href={item.receipt_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={cn(buttonVariants({ variant: 'outline', size: 'sm' }))}
                    >
                      Download invoice (PDF)
                    </a>
                  ) : (
                    <span className="text-small text-muted-foreground">No invoice</span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  )
}
