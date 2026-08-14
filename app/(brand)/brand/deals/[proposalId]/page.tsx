import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getUser } from '@/lib/supabase/auth'
import { getContract } from '@/lib/supabase/deals'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import ContractSignButton from '@/components/deals/contract-sign-button'
import ProposalWithdrawButton from '@/components/deals/proposal-withdraw-button'
import { AccentHeading } from '@/components/ui/accent-heading'
import type { Database } from '@/types/database'

type ContractRow = Database['public']['Tables']['contracts']['Row']

export default async function BrandProposalDetailPage({
  params,
}: {
  params: Promise<{ proposalId: string }>
}) {
  const { proposalId } = await params
  const supabase = await createClient()
  const user = await getUser(supabase)
  if (!user) redirect('/auth')

  let proposal
  try {
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

  const payLabel = proposal.pay_type.replace('_', ' ')
  const amount = new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: proposal.pay_currency ?? 'GBP',
    maximumFractionDigits: 0,
  }).format(proposal.pay_amount)

  return (
    <div className="mx-auto max-w-2xl space-y-12 px-6 py-12 md:px-16 md:py-16">
      <div className="flex items-center gap-3">
        <Link href="/brand/deals" className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }))}>
          ← Back
        </Link>
      </div>

      <div className="rounded-xl border bg-card p-6 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <AccentHeading as="h1" className="text-large">{proposal.title}</AccentHeading>
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
              <dd className="min-w-0 break-words">{proposal.timeline_start}{proposal.timeline_end ? ` → ${proposal.timeline_end}` : ''}</dd>
            </>
          )}
          {proposal.additional_terms && (
            <>
              <dt className="text-muted-foreground">Additional terms</dt>
              <dd className="min-w-0 break-words">{proposal.additional_terms}</dd>
            </>
          )}
        </dl>

        {proposal.status === 'pending' && proposal.sender_id === user.id && (
          <ProposalWithdrawButton proposalId={proposalId} />
        )}
      </div>

      {contract && (
        <div className="rounded-xl border bg-card p-6 space-y-4">
          <h2 className="font-semibold">Contract</h2>
          <dl className="grid grid-cols-1 gap-y-2 text-sm sm:grid-cols-2 sm:gap-x-4">
            <dt className="text-muted-foreground">Status</dt>
            <dd className="min-w-0 break-words capitalize">{contract.status.replace(/_/g, ' ')}</dd>
            {contract.brand_signed_at && (
              <>
                <dt className="text-muted-foreground">Your signature</dt>
                <dd className="min-w-0 break-words">{new Date(contract.brand_signed_at).toLocaleDateString()}</dd>
              </>
            )}
            {contract.athlete_signed_at && (
              <>
                <dt className="text-muted-foreground">Athlete signature</dt>
                <dd className="min-w-0 break-words">{new Date(contract.athlete_signed_at).toLocaleDateString()}</dd>
              </>
            )}
          </dl>
          <ContractSignButton
            contractId={contract.id}
            status={contract.status}
            isBrand={true}
            alreadySigned={!!contract.brand_signed_at}
          />
        </div>
      )}
    </div>
  )
}
