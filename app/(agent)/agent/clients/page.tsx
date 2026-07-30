import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'

import { createClient } from '@/lib/supabase/server'
import { getUser } from '@/lib/supabase/auth'
import { getOwnProfile } from '@/lib/supabase/profiles'
import { getAgentClients, getAgentDealPipeline } from '@/lib/supabase/agents'
import { resolveClientDisplays, UNKNOWN_CLIENT } from '@/lib/supabase/agent-clients'
import { buttonVariants } from '@/components/ui/button'
import type { AgentClientRow } from '@/components/agent/client-table'
import { ROUTES } from '@/lib/routes'
import type { Database } from '@/types/database'

import ClientRoster from '../dashboard/client-roster'
import { revokeClientAction } from '../dashboard/actions'

/**
 * M-1 — an authenticated route. `robots.ts` already disallows it, but a crawler
 * that follows a shared link never reads robots.txt, so say it here too.
 */
export const metadata: Metadata = {
  title: 'Your clients · Podium',
  description: 'The athletes and teams your agency represents on Podium.',
  robots: { index: false },
}


type AgentRow = Database['public']['Tables']['agent_profiles']['Row']

/**
 * B-4 — the agent nav's "Clients" item pointed at `/agent/clients`, which did
 * not exist. The roster itself was only reachable as a section of the
 * dashboard; this gives it the dedicated destination the nav promises.
 */
export default async function AgentClientsPage() {
  const supabase = await createClient()
  const user = await getUser(supabase)
  if (!user) redirect(ROUTES.auth.signIn)
  if (user.role !== 'agent') redirect(ROUTES.forbidden)

  // getOwnProfile returns the role union; role 'agent' narrows it to AgentRow.
  const profile = (await getOwnProfile(supabase, user.id, 'agent')) as AgentRow | null
  if (!profile) redirect(ROUTES.agent.onboarding)

  const [links, contracts] = await Promise.all([
    getAgentClients(supabase, profile.id),
    getAgentDealPipeline(supabase, user.id),
  ])

  // Resolves athlete AND team clients. This used to enrich only links whose
  // client_role was 'athlete' while still rendering a row for every link, so a
  // team client appeared as a nameless "Client" with no sport or level.
  const displayByUserId = await resolveClientDisplays(supabase, links)

  const activeDealsByUser = new Map<string, number>()
  for (const c of contracts) {
    if (c.status === 'terminated') continue
    activeDealsByUser.set(
      c.athlete_or_team_id,
      (activeDealsByUser.get(c.athlete_or_team_id) ?? 0) + 1
    )
  }

  const clients: AgentClientRow[] = links.map((l) => {
    const display = displayByUserId.get(l.client_user_id) ?? UNKNOWN_CLIENT
    return {
      linkId: l.id,
      clientUserId: l.client_user_id,
      ...display,
      activeDeals: activeDealsByUser.get(l.client_user_id) ?? 0,
    }
  })

  return (
    <div className="mx-auto max-w-6xl space-y-10 px-6 py-12 md:px-16 md:py-16">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-heading text-display font-extrabold tracking-tight text-foreground">
            Clients
          </h1>
          <p className="mt-3 text-medium text-muted-foreground">
            {clients.length} {clients.length === 1 ? 'client' : 'clients'} you represent
          </p>
        </div>
        <Link href={ROUTES.agent.clientsNew} className={buttonVariants({ size: 'sm' })}>
          Add client
        </Link>
      </header>

      <ClientRoster clients={clients} onRevoke={revokeClientAction} />
    </div>
  )
}
