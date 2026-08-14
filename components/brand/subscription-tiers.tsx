'use client'

import { useState } from 'react'
import { Check, X } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Sticker } from '@/components/ui/sticker'
import { cn } from '@/lib/utils'
import { track } from '@/lib/analytics'
import { CONTROLLER } from '@/lib/legal/versions'
import {
  TIERS as CONFIG_TIERS,
  TIER_NAMES,
  TIER_PRICE_DISPLAY,
  TIER_TAGLINE,
  POPULAR_TIER,
  COMPARISON_ROWS,
  type Tier as TierId,
} from '@/lib/entitlements'
import type { Database } from '@/types/database'

type SubscriptionRow = Database['public']['Tables']['subscriptions']['Row']

interface Props {
  subscription: SubscriptionRow | null
}

interface Tier {
  tier: TierId
  name: string
  price: string
  cadence: string
  tagline: string
  popular?: boolean
}

const TIERS: Tier[] = CONFIG_TIERS.map((tier) => ({
  tier,
  name: TIER_NAMES[tier],
  price: TIER_PRICE_DISPLAY[tier],
  cadence: '/mo',
  tagline: TIER_TAGLINE[tier],
  popular: tier === POPULAR_TIER,
}))

// Feature comparison matrix. `value` is either a boolean (tick/cross) or a string (e.g. limits).
const FEATURES = COMPARISON_ROWS

function ValueCell({ value }: { value: boolean | string }) {
  if (value === true) {
    return (
      <span className="inline-flex items-center justify-center text-success" aria-label="Included">
        <Check className="size-4" aria-hidden="true" />
      </span>
    )
  }
  if (value === false) {
    return (
      <span className="inline-flex items-center justify-center text-muted-foreground" aria-label="Not included">
        <X className="size-4" aria-hidden="true" />
      </span>
    )
  }
  return <span className="text-small text-foreground">{value}</span>
}

function CurrentSubscription({ subscription }: { subscription: SubscriptionRow }) {
  const currentTier = TIERS.find((t) => t.tier === subscription.tier)
  const trialActive =
    subscription.trial_ends_at && new Date(subscription.trial_ends_at) > new Date()

  return (
    <div className="space-y-4">
      <div className="space-y-2 rounded-xl border border-border bg-card p-4 shadow-card">
        <p className="text-small font-semibold uppercase tracking-wide text-muted-foreground">
          Current plan
        </p>
        <p className="text-large font-bold">{currentTier?.name ?? `Tier ${subscription.tier}`}</p>
        <p className="text-medium capitalize text-muted-foreground">{subscription.status}</p>
        {trialActive && (
          <p className="text-small text-accent-foreground">
            Free trial ends {new Date(subscription.trial_ends_at!).toLocaleDateString()}
          </p>
        )}
        {subscription.cancellation_scheduled_at && (
          <p className="text-small text-destructive">
            Cancels at end of billing period ({new Date(subscription.current_period_end).toLocaleDateString()})
          </p>
        )}
      </div>
      <p className="text-medium text-muted-foreground">
        {/* podium.com is not our domain — the address must come from
            CONTROLLER so support mail can never route to a third party. */}
        To change your plan, contact{' '}
        <a href={`mailto:${CONTROLLER.supportEmail}`} className="underline">
          {CONTROLLER.supportEmail}
        </a>
        .
      </p>
    </div>
  )
}

export default function SubscriptionTiers({ subscription }: Props) {
  const [loadingTier, setLoadingTier] = useState<TierId | null>(null)

  async function handleStartTrial(tier: TierId) {
    setLoadingTier(tier)
    try {
      const res = await fetch('/api/payments/subscriptions/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tier }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error?.message ?? 'Failed to start checkout')
        return
      }
      // M-6 `subscription_checkout_started` — after Stripe returned a session
      // URL (2xx), before the redirect leaves the page. A click that failed to
      // create a session is not a started checkout. Tier number only: no
      // customer, session or price identifier.
      track('subscription_checkout_started', { tier })
      window.location.href = data.url
    } catch {
      toast.error('Something went wrong. Please try again.')
    } finally {
      setLoadingTier(null)
    }
  }

  if (subscription) {
    return <CurrentSubscription subscription={subscription} />
  }

  return (
    <div className="space-y-12">
      {/* Pricing cards — side by side on desktop, stacked on mobile */}
      <div className="grid gap-6 md:grid-cols-3">
        {TIERS.map((t) => (
          <div
            key={t.tier}
            data-testid={`tier-card-${t.tier}`}
            data-featured={t.popular ? 'true' : 'false'}
            className={cn(
              // Flat, minimal surface: card background, hairline border, soft shadow.
              'relative flex flex-col rounded-2xl border border-border bg-card p-6 shadow-sm',
              // Featured tier is highlighted with a primary border and a slightly
              // stronger soft shadow — no folded corner, no hard offset.
              t.popular && 'border-primary shadow-card'
            )}
          >
            {t.popular && (
              <>
                {/* "Most popular" + "7-day free trial" Stickers — flat, upright
                    accent pills (clean Airbnb aesthetic), no tilt. */}
                <Sticker className="absolute -top-3 left-1/2 -translate-x-1/2">
                  Most popular
                </Sticker>
                <Sticker className="absolute -right-2 top-8">
                  7-day free trial
                </Sticker>
              </>
            )}
            <div className="space-y-1">
              <p className="text-medium font-bold">{t.name}</p>
              <p className="text-medium text-muted-foreground">{t.tagline}</p>
            </div>
            <div className="mt-4 flex items-baseline gap-1">
              <span className="text-large font-extrabold">{t.price}</span>
              <span className="text-medium text-muted-foreground">{t.cadence}</span>
            </div>
            {!t.popular && (
              <p className="mt-2 text-medium font-semibold text-success">
                Starts with a 7-day free trial
              </p>
            )}
            <Button
              className="mt-6 w-full"
              variant={t.popular ? 'default' : 'outline'}
              disabled={loadingTier !== null}
              onClick={() => handleStartTrial(t.tier)}
            >
              {loadingTier === t.tier ? 'Redirecting…' : 'Start Free Trial'}
            </Button>
          </div>
        ))}
      </div>

      {/* Comparison table — horizontally scrollable on small screens */}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[32rem] border-collapse text-left">
          <caption className="sr-only">Feature comparison across subscription tiers</caption>
          <thead>
            <tr className="border-b border-border">
              <th scope="col" className="py-2 pr-4 text-medium font-semibold">
                Features
              </th>
              {TIERS.map((t) => (
                <th
                  key={t.tier}
                  scope="col"
                  className={cn(
                    'px-3 py-2 text-center text-medium font-semibold',
                    t.popular && 'text-accent-foreground'
                  )}
                >
                  {t.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {FEATURES.map((row) => (
              <tr key={row.label} className="border-b border-border">
                <th scope="row" className="py-2 pr-4 text-medium font-normal text-muted-foreground">
                  {row.label}
                </th>
                {TIERS.map((t) => (
                  <td key={t.tier} className="px-3 py-2 text-center">
                    <ValueCell value={row.values[t.tier]} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-center text-small text-muted-foreground">
        Every plan starts with a 7-day free trial. Cancel anytime from Settings.
      </p>
    </div>
  )
}
