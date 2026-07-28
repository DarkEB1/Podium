'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { buttonVariants } from '@/components/ui/button'

interface Props {
  payoutsEnabled: boolean
  detailsSubmitted: boolean
  hasAccount: boolean
}

/** Stripe Connect payout onboarding/status (spec §payments). */
export default function PayoutsSection({ payoutsEnabled, detailsSubmitted, hasAccount }: Props) {
  const [busy, setBusy] = useState(false)

  async function start() {
    setBusy(true)
    try {
      const res = await fetch('/api/account/connect', { method: 'POST' })
      const json = (await res.json().catch(() => ({}))) as { url?: string; error?: { message?: string } }
      if (!res.ok || !json.url) {
        toast.error(json.error?.message ?? 'Could not start payout setup.')
        setBusy(false)
        return
      }
      window.location.href = json.url
    } catch {
      toast.error('Could not start payout setup.')
      setBusy(false)
    }
  }

  const status = payoutsEnabled
    ? 'Payouts are enabled. You can receive deal payments.'
    : hasAccount && detailsSubmitted
      ? 'Your details are submitted and under review by Stripe.'
      : hasAccount
        ? 'Finish your payout setup to receive deal payments.'
        : 'Set up payouts to receive deal payments.'

  return (
    <section className="mt-12">
      <h2 className="font-heading text-large font-semibold text-foreground">Payouts</h2>
      <p className="mt-3 text-medium text-muted-foreground">{status}</p>
      {!payoutsEnabled && (
        <button type="button" onClick={start} disabled={busy} className={cn(buttonVariants(), 'mt-4', busy && 'opacity-60')}>
          {busy ? 'Opening Stripe…' : hasAccount ? 'Continue payout setup' : 'Set up payouts'}
        </button>
      )}
    </section>
  )
}
