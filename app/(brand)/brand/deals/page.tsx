import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getUser } from '@/lib/supabase/auth'
import { getProposalsForUser } from '@/lib/supabase/deals'
import ProposalCard from '@/components/deals/proposal-card'
import { AccentHeading } from '@/components/ui/accent-heading'

export default async function BrandDealsPage() {
  const supabase = await createClient()
  const user = await getUser(supabase)
  if (!user) redirect('/auth')

  const proposals = await getProposalsForUser(supabase, user.id)
  const sent = proposals.filter((p) => p.sender_id === user.id)
  const active = sent.filter((p) => p.status === 'pending' || p.status === 'accepted')
  const history = sent.filter((p) => p.status !== 'pending' && p.status !== 'accepted')

  return (
    <div className="mx-auto max-w-3xl space-y-12 px-6 py-12 md:px-16 md:py-16">
      <div>
        <AccentHeading as="h1" className="text-display">Deals</AccentHeading>
        <p className="mt-3 text-medium text-muted-foreground">Proposals you have sent to athletes</p>
      </div>

      <section className="space-y-3">
        <h2 className="text-base font-semibold">Active ({active.length})</h2>
        {active.length === 0 ? (
          <p className="text-sm text-muted-foreground">No active proposals. Find athletes to connect with.</p>
        ) : (
          active.map((p) => (
            <ProposalCard key={p.id} proposal={p} href={`/brand/deals/${p.id}`} />
          ))
        )}
      </section>

      {history.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-base font-semibold">History</h2>
          {history.map((p) => (
            <ProposalCard key={p.id} proposal={p} href={`/brand/deals/${p.id}`} />
          ))}
        </section>
      )}
    </div>
  )
}
