import { cn } from '@/lib/utils'
import type { Database } from '@/types/database'

type ProposalRow = Database['public']['Tables']['proposals']['Row']
type ProposalStatus = Database['public']['Enums']['proposal_status']

const STATUS_STYLES: Record<ProposalStatus, string> = {
  pending: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
  accepted: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  declined: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  countered: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  withdrawn: 'bg-muted text-muted-foreground',
}

interface ProposalCardProps {
  proposal: ProposalRow
  href: string
}

export default function ProposalCard({ proposal, href }: ProposalCardProps) {
  const payLabel = proposal.pay_type.replace('_', ' ')
  const amount = new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: proposal.pay_currency ?? 'GBP',
    maximumFractionDigits: 0,
  }).format(proposal.pay_amount)

  return (
    <a
      href={href}
      className="block rounded-xl border bg-card p-4 hover:bg-muted/50 transition-colors"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-medium truncate">{proposal.title}</p>
          <p className="text-sm text-muted-foreground mt-0.5">
            {amount} · {payLabel}
          </p>
        </div>
        <span
          className={cn(
            'shrink-0 inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium capitalize',
            STATUS_STYLES[proposal.status]
          )}
        >
          {proposal.status.replace('_', ' ')}
        </span>
      </div>
      {proposal.timeline_start && (
        <p className="text-xs text-muted-foreground mt-2">
          {proposal.timeline_start}
          {proposal.timeline_end ? ` → ${proposal.timeline_end}` : ''}
        </p>
      )}
    </a>
  )
}
