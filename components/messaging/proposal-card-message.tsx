'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import type { Database } from '@/types/database'

type ProposalRow = Database['public']['Tables']['proposals']['Row']

interface Props {
  proposal: ProposalRow
  isMine: boolean
  onResponded: () => void
}

const PAY_TYPE_LABEL: Record<string, string> = {
  flat_fee: 'Flat fee',
  monthly_retainer: 'Monthly retainer',
  per_post: 'Per post',
  revenue_share: 'Revenue share',
}

function cn(...classes: (string | boolean | undefined)[]) {
  return classes.filter(Boolean).join(' ')
}

export default function ProposalCardMessage({ proposal, isMine, onResponded }: Props) {
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
      if (!res.ok) { toast.error(data.error?.message ?? 'Failed'); return }
      toast.success(action === 'accepted' ? 'Proposal accepted!' : 'Proposal declined')
      onResponded()
    } finally {
      setLoading(null)
    }
  }

  return (
    <div className="rounded-xl border bg-card p-4 space-y-3 max-w-sm">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">Proposal</p>
        <span className={cn(
          'text-xs rounded-full px-2 py-0.5 font-medium',
          proposal.status === 'pending' ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' :
          proposal.status === 'accepted' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
          'bg-muted text-muted-foreground'
        )}>
          {proposal.status}
        </span>
      </div>
      <p className="font-semibold">{proposal.title}</p>
      <dl className="space-y-1 text-sm">
        <div className="flex gap-2">
          <dt className="text-muted-foreground w-20">Amount</dt>
          <dd>{proposal.pay_currency} {proposal.pay_amount.toLocaleString()}</dd>
        </div>
        <div className="flex gap-2">
          <dt className="text-muted-foreground w-20">Type</dt>
          <dd>{PAY_TYPE_LABEL[proposal.pay_type] ?? proposal.pay_type}</dd>
        </div>
        {proposal.timeline_start && (
          <div className="flex gap-2">
            <dt className="text-muted-foreground w-20">Start</dt>
            <dd>{new Date(proposal.timeline_start).toLocaleDateString()}</dd>
          </div>
        )}
      </dl>
      {!isMine && proposal.status === 'pending' && (
        <div className="flex gap-2 pt-1">
          <Button size="sm" onClick={() => respond('accepted')} disabled={loading !== null}>
            {loading === 'accepted' ? 'Accepting…' : 'Accept'}
          </Button>
          <Button variant="outline" size="sm" onClick={() => respond('declined')} disabled={loading !== null}>
            {loading === 'declined' ? 'Declining…' : 'Decline'}
          </Button>
        </div>
      )}
    </div>
  )
}
