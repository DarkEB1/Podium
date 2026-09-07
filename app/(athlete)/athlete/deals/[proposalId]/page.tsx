import { redirect, notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getUser } from '@/lib/supabase/auth'
import { getContract } from '@/lib/supabase/deals'
import { buttonVariants } from '@/components/ui/button'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import ContractSignButton from '@/components/deals/contract-sign-button'
import ProposalRespondButtons from '@/components/deals/proposal-respond-buttons'
import { AccentHeading } from '@/components/ui/accent-heading'
import { formatMajorAmount } from '@/lib/money'
import { formatDate, formatDateRange } from '@/lib/dates'
import type { Database } from '@/types/database'

type ContractRow = Database['public']['Tables']['contracts']['Row']

export default async function AthleteProposalDetailPage({
  params,
}: {
  params: Promise<{ proposalId: string }>
}) {
  const { proposalId } = await params
  const supabase = await createClient()
  const user = await getUser(supabase)
  if (!user) redirect('/auth')

  // Find the proposal across all user's matches
  let proposal
  try {
    // We'll fetch via the match embedded in proposals — find the match for this proposal
    const { data } = await (supabase as import('@supabase/supabase-js').SupabaseClient)
      .from('proposals')
      .select('*')
      .eq('id', proposalId)
      .single()
    proposal = data
  } catch {
    notFound()
  }

  if (!proposal) notFound()

  let contract: ContractRow | null = null
  if (proposal.status === 'accepted') {
    try {
      contract = (await getContract(supabase, proposalId)) as ContractRow | null
    } catch { /* contract may not exist yet */ }
  }

  const isSender = proposal.sender_id === user.id
  const payLabel = proposal.pay_type.replace('_', ' ')
  // DP-4/DP-5: guarded 2dp formatter (the inline Intl call crashed the page on
  // a junk currency and rounded amounts to whole pounds).
  const amount = formatMajorAmount(proposal.pay_amount, proposal.pay_currency ?? 'GBP')

  return (
    <div className="mx-auto max-w-2xl space-y-12 px-6 py-12 md:px-16 md:py-16">
      <div className="flex items-center gap-3">
        <Link href="/athlete/deals" className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }))}>
          ← Back
        </Link>
      </div>

      <div className="rounded-xl border bg-card p-6 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <AccentHeading as="h1" className="text-display">{proposal.title}</AccentHeading>
          <span className="shrink-0 inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-muted text-muted-foreground capitalize">
            {proposal.status}
          </span>
        </div>

        <dl className="grid grid-cols-1 gap-y-2 text-sm sm:grid-cols-2 sm:gap-x-4">
          <dt className="text-muted-foreground">Compensation</dt>
          <dd className="min-w-0 break-words font-medium">{amount} · {payLabel}</dd>
          {proposal.timeline_start && (
            <>
              <dt className="text-muted-foreground">Timeline</dt>
              <dd className="min-w-0 break-words">{formatDateRange(proposal.timeline_start, proposal.timeline_end)}</dd>
            </>
          )}
          {proposal.additional_terms && (
            <>
              <dt className="text-muted-foreground">Additional terms</dt>
              <dd className="min-w-0 break-words">{proposal.additional_terms}</dd>
            </>
          )}
        </dl>

        {!isSender && proposal.status === 'pending' && (
          <ProposalRespondButtons proposalId={proposalId} />
        )}
      </div>

      {contract && (
        <div className="rounded-xl border bg-card p-6 space-y-4">
          <h2 className="font-semibold">Contract</h2>
          <dl className="grid grid-cols-1 gap-y-2 text-sm sm:grid-cols-2 sm:gap-x-4">
            <dt className="text-muted-foreground">Status</dt>
            <dd className="min-w-0 break-words capitalize">{contract.status.replace(/_/g, ' ')}</dd>
            {contract.athlete_signed_at && (
              <>
                <dt className="text-muted-foreground">Your signature</dt>
                <dd className="min-w-0 break-words">{new Date(contract.athlete_signed_at).toLocaleDateString()}</dd>
              </>
            )}
            {contract.brand_signed_at && (
              <>
                <dt className="text-muted-foreground">Brand signature</dt>
                <dd className="min-w-0 break-words">{new Date(contract.brand_signed_at).toLocaleDateString()}</dd>
              </>
            )}
          </dl>
          <ContractSignButton
            contractId={contract.id}
            status={contract.status}
            isBrand={false}
            alreadySigned={!!contract.athlete_signed_at}
          />
        </div>
      )}
    </div>
  )
}
