'use client'

import { useState } from 'react'
import { Check } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { track } from '@/lib/analytics'
import { formatMajorAmount } from '@/lib/money'
import { formatDate } from '@/lib/dates'
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
  /**
   * M-6 — role of the person acting on this card, used as the `role` property
   * of `proposal_accepted`. Optional; falls back to `unknown`.
   */
  viewerRole?: string | undefined
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
  viewerRole,
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
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error(data.error?.message ?? 'Failed')
        return
      }
      // M-6 `proposal_accepted` — the deal-is-on step, fired only after the
      // respond endpoint returned 2xx and only for an acceptance. There is no
      // `proposal_declined` in the catalogue, so a decline records nothing.
      if (action === 'accepted') {
        track('proposal_accepted', { role: viewerRole ?? 'unknown' })
      }
      toast.success(action === 'accepted' ? 'Proposal accepted!' : 'Proposal declined')
      onResponded()
    } catch {
      // DP-12: a dropped connection mid-request was an unhandled rejection with
      // no user feedback. Surface it and let them retry.
      toast.error('Something went wrong. Please try again.')
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
        className="max-w-sm space-y-1 rounded-2xl border border-success/30 bg-success/10 p-6 shadow-sm"
      >
        <div className="flex items-center gap-2">
          <Check aria-hidden="true" className="size-4 shrink-0 text-success" />
          <p className="text-medium font-semibold text-foreground">Payment confirmed</p>
        </div>
        <p className="text-medium text-foreground">
          {formatMajorAmount(paymentConfirmation.amount, paymentConfirmation.currency)}
        </p>
        <p className="text-small text-muted-foreground">{proposal.title}</p>
      </div>
    )
  }

  return (
    <div
      data-testid="proposal-card"
      className="max-w-sm space-y-4 rounded-2xl border border-border bg-card p-6 shadow-sm"
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
          <dd>{formatMajorAmount(proposal.pay_amount, proposal.pay_currency)}</dd>
        </div>
        <div className="flex gap-2">
          <dt className="w-20 text-muted-foreground">Type</dt>
          <dd>{PAY_TYPE_LABEL[proposal.pay_type] ?? proposal.pay_type}</dd>
        </div>
        {proposal.timeline_start && (
          <div className="flex gap-2">
            <dt className="w-20 text-muted-foreground">Start</dt>
            <dd>{formatDate(proposal.timeline_start)}</dd>
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
