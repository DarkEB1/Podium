import { cn } from '@/lib/utils'
import type { Database } from '@/types/database'

type ProposalRow = Database['public']['Tables']['proposals']['Row']
type ProposalStatus = Database['public']['Enums']['proposal_status']

// Semantic-token tints (mirrors components/ui/status-badges.tsx) so the palette
// tracks the design tokens and adapts to dark mode without explicit dark: rules.
const STATUS_STYLES: Record<ProposalStatus, string> = {
  pending: 'bg-warning/15 text-warning',
  accepted: 'bg-success/15 text-success',
  declined: 'bg-destructive/15 text-destructive',
  countered: 'bg-primary/10 text-primary',
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
