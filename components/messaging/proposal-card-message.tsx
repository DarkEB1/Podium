'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { Database } from '@/types/database'

type ProposalRow = Database['public']['Tables']['proposals']['Row']

interface PaymentConfirmation {
  amount: number
  currency: string
}

interface Props {
  proposal: ProposalRow
  isMine: boolean
  onResponded: () => void
  /** When set, this message represents a completed payment — render a success card. */
  paymentConfirmation?: PaymentConfirmation | undefined
  /** Open the counter-offer flow (free-text/proposal composer) in the parent. */
  onCounter?: (() => void) | undefined
}

const PAY_TYPE_LABEL: Record<string, string> = {
  flat_fee: 'Flat fee',
  monthly_retainer: 'Monthly retainer',
  per_post: 'Per post',
  revenue_share: 'Revenue share',
}

const STATUS_STYLE: Record<string, string> = {
  pending: 'bg-warning/15 text-foreground',
  accepted: 'bg-success/15 text-foreground',
  declined: 'bg-muted text-muted-foreground',
}

export default function ProposalCardMessage({
  proposal,
  isMine,
  onResponded,
  paymentConfirmation,
  onCounter,
}: Props) {
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
      if (!res.ok) {
        toast.error(data.error?.message ?? 'Failed')
        return
      }
      toast.success(action === 'accepted' ? 'Proposal accepted!' : 'Proposal declined')
      onResponded()
    } finally {
      setLoading(null)
    }
  }

  // Payment confirmation — distinct green success card (spec §7.2).
  if (paymentConfirmation) {
    return (
      <div
        data-testid="payment-confirmation-card"
        role="status"
        className="max-w-sm space-y-1 rounded-xl border border-success/30 bg-success/10 p-4 shadow-card"
      >
        <div className="flex items-center gap-2">
          <span aria-hidden="true" className="text-success text-base">✓</span>
          <p className="text-medium font-semibold text-foreground">Payment confirmed</p>
        </div>
        <p className="text-medium text-foreground">
          {paymentConfirmation.currency} {paymentConfirmation.amount.toLocaleString()}
        </p>
        <p className="text-small text-muted-foreground">{proposal.title}</p>
      </div>
    )
  }

  return (
    <div
      data-testid="proposal-card"
      className="max-w-sm space-y-3 rounded-xl border bg-card p-4 shadow-card"
    >
      <div className="flex items-center justify-between">
        <p className="text-small font-medium uppercase tracking-wide text-muted-foreground">Proposal</p>
        <span
          className={cn(
            'rounded-full px-2 py-0.5 text-small font-medium',
            STATUS_STYLE[proposal.status] ?? 'bg-muted text-muted-foreground'
          )}
        >
          {proposal.status}
        </span>
      </div>
      <p className="text-medium font-semibold">{proposal.title}</p>
      <dl className="space-y-1 text-medium">
        <div className="flex gap-2">
          <dt className="w-20 text-muted-foreground">Amount</dt>
          <dd>
            {proposal.pay_currency} {proposal.pay_amount.toLocaleString()}
          </dd>
        </div>
        <div className="flex gap-2">
          <dt className="w-20 text-muted-foreground">Type</dt>
          <dd>{PAY_TYPE_LABEL[proposal.pay_type] ?? proposal.pay_type}</dd>
        </div>
        {proposal.timeline_start && (
          <div className="flex gap-2">
            <dt className="w-20 text-muted-foreground">Start</dt>
            <dd>{new Date(proposal.timeline_start).toLocaleDateString()}</dd>
          </div>
        )}
      </dl>
      {!isMine && proposal.status === 'pending' && (
        <div className="flex flex-wrap gap-2 pt-1">
          <Button size="sm" onClick={() => respond('accepted')} disabled={loading !== null}>
            {loading === 'accepted' ? 'Accepting…' : 'Accept'}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={onCounter}
            disabled={loading !== null || !onCounter}
          >
            Counter
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
      )}
    </div>
  )
}
