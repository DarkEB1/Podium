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
    } catch {
      toast.error('Something went wrong. Please try again.')
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
                  <span className="text-green-500 mt-0.5" aria-hidden="true">✓</span>
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
