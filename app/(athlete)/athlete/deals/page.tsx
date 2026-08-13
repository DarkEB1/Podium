import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getUser } from '@/lib/supabase/auth'
import { getProposalsForUser } from '@/lib/supabase/deals'
import ProposalCard from '@/components/deals/proposal-card'
import { AccentHeading } from '@/components/ui/accent-heading'

export default async function AthleteDealsPage() {
  const supabase = await createClient()
  const user = await getUser(supabase)
  if (!user) redirect('/auth')

  const proposals = await getProposalsForUser(supabase, user.id)
  const received = proposals.filter((p) => p.sender_id !== user.id)
  const pending = received.filter((p) => p.status === 'pending')
  const history = received.filter((p) => p.status !== 'pending')

  return (
    <div className="mx-auto max-w-3xl px-6 py-12 space-y-12 md:px-8">
      <div>
        <AccentHeading as="h1" className="text-display">Deals</AccentHeading>
        <p className="mt-3 text-medium text-muted-foreground">Proposals and contracts from brands</p>
      </div>

      <section className="space-y-3">
        <h2 className="text-base font-semibold">Pending ({pending.length})</h2>
        {pending.length === 0 ? (
          <p className="text-sm text-muted-foreground">No pending proposals.</p>
        ) : (
          pending.map((p) => (
            <ProposalCard key={p.id} proposal={p} href={`/athlete/deals/${p.id}`} />
          ))
        )}
      </section>

      {history.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-base font-semibold">History</h2>
          {history.map((p) => (
            <ProposalCard key={p.id} proposal={p} href={`/athlete/deals/${p.id}`} />
          ))}
        </section>
      )}
    </div>
  )
}
