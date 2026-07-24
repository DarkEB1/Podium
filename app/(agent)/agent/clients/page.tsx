import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'

import { createClient } from '@/lib/supabase/server'
import { getUser } from '@/lib/supabase/auth'
import { getOwnProfile, getPublicProfile } from '@/lib/supabase/profiles'
import { getAgentClients, getAgentDealPipeline } from '@/lib/supabase/agents'
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


type AthleteRow = Database['public']['Tables']['athlete_profiles']['Row']
type AgentRow = Database['public']['Tables']['agent_profiles']['Row']

const LEVEL_LABELS: Record<string, string> = {
  recreational: 'Recreational',
  amateur: 'Amateur',
  semi_professional: 'Semi-Professional',
  professional: 'Professional',
  international: 'International',
  university_bucs: 'University/BUCS',
  academy: 'Academy',
  national: 'National',
}

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

  const athleteByUserId = new Map<string, AthleteRow>()
  await Promise.all(
    links
      .filter((l) => l.client_role === 'athlete')
      .map(async (l) => {
        // getPublicProfile returns the role union; client_role narrows it.
        const p = (await getPublicProfile(supabase, l.client_user_id, 'athlete')) as AthleteRow | null
        if (p) athleteByUserId.set(l.client_user_id, p)
      })
  )

  const activeDealsByUser = new Map<string, number>()
  for (const c of contracts) {
    if (c.status === 'terminated') continue
    activeDealsByUser.set(
      c.athlete_or_team_id,
      (activeDealsByUser.get(c.athlete_or_team_id) ?? 0) + 1
    )
  }

  const clients: AgentClientRow[] = links.map((l) => {
    const athlete = athleteByUserId.get(l.client_user_id)
    return {
      linkId: l.id,
      clientUserId: l.client_user_id,
      name: athlete?.display_name ?? 'Client',
      photoUrl: athlete?.profile_photo_url ?? null,
      sport: athlete?.primary_sport ?? null,
      level: athlete?.level ? (LEVEL_LABELS[athlete.level] ?? athlete.level) : null,
      activeDeals: activeDealsByUser.get(l.client_user_id) ?? 0,
      lastActivity: athlete?.last_active_at ?? null,
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
