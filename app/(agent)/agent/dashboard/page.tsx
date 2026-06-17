import { redirect } from 'next/navigation'

import { createClient } from '@/lib/supabase/server'
import { getUser } from '@/lib/supabase/auth'
import { getOwnProfile, getPublicProfile } from '@/lib/supabase/profiles'
import { getAgentClients, getAgentDealPipeline } from '@/lib/supabase/agents'
import StatStrip from '@/components/layout/stat-strip'
import { AccentHeading } from '@/components/ui/accent-heading'
import { SectionDivider } from '@/components/ui/section-divider'
import DealPipeline, {
  stageForContractStatus,
  type PipelineDeal,
} from '@/components/agent/deal-pipeline'
import type { AgentClientRow } from '@/components/agent/client-table'
import type { Database } from '@/types/database'

import ClientRoster from './client-roster'
import { revokeClientAction } from './actions'

type AthleteRow = Database['public']['Tables']['athlete_profiles']['Row']
type BrandRow = Database['public']['Tables']['brand_profiles']['Row']

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

export default async function AgentDashboardPage() {
  const supabase = await createClient()
  const user = await getUser(supabase)

  if (!user) redirect('/auth')
  if (user.role !== 'agent') redirect('/403')

  // getOwnProfile is a union over every role's row; the (agent) layout
  // guarantees the agent shape here.
  const profile = (await getOwnProfile(supabase, user.id, 'agent')) as
    | Database['public']['Tables']['agent_profiles']['Row']
    | null
  if (!profile) redirect('/agent/onboarding')

  // Clients (representation_links) are keyed by agent_profiles.id; contracts
  // are keyed by users.id (see types/database.ts FK targets).
  const [links, contracts] = await Promise.all([
    getAgentClients(supabase, profile.id),
    getAgentDealPipeline(supabase, user.id),
  ])

  // Enrich athlete clients with display data. Only athlete clients carry the
  // photo/sport/level the table shows; team clients fall back to id-only.
  const athleteByUserId = new Map<string, AthleteRow>()
  await Promise.all(
    links
      .filter((l) => l.client_role === 'athlete')
      .map(async (l) => {
        // getPublicProfile is a union over roles; client_role narrows it.
        const p = (await getPublicProfile(
          supabase,
          l.client_user_id,
          'athlete'
        )) as AthleteRow | null
        if (p) athleteByUserId.set(l.client_user_id, p)
      })
  )

  // Active deals per client user id (a contract is active unless terminated).
  const activeDealsByUser = new Map<string, number>()
  for (const c of contracts) {
    if (c.status === 'terminated') continue
    activeDealsByUser.set(
      c.athlete_or_team_id,
      (activeDealsByUser.get(c.athlete_or_team_id) ?? 0) + 1
    )
  }

  const clientRows: AgentClientRow[] = links.map((l) => {
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

  // Build the pipeline view-model. Resolve brand names; resolve client names
  // from the athletes already fetched, else fall back to a label.
  const brandIds = Array.from(new Set(contracts.map((c) => c.brand_id)))
  const brandById = new Map<string, BrandRow>()
  await Promise.all(
    brandIds.map(async (id) => {
      const b = (await getPublicProfile(supabase, id, 'brand')) as BrandRow | null
      if (b) brandById.set(id, b)
    })
  )

  const deals: PipelineDeal[] = contracts
    .map((c): PipelineDeal | null => {
      const stage = stageForContractStatus(c.status)
      if (!stage) return null
      return {
        id: c.id,
        clientName: athleteByUserId.get(c.athlete_or_team_id)?.display_name ?? 'Client',
        brandName: brandById.get(c.brand_id)?.company_name ?? 'Brand',
        stage,
        updatedAt: c.updated_at,
      }
    })
    .filter((d): d is PipelineDeal => d !== null)

  // Pending actions = deals waiting on a signature (the agent's queue).
  const pendingActions = deals.filter((d) => d.stage === 'awaiting_signature').length

  const stats = [
    { label: 'Clients', value: String(clientRows.length) },
    {
      label: 'Active deals',
      value: String(deals.filter((d) => d.stage !== 'completed').length),
    },
    { label: 'Completed', value: String(deals.filter((d) => d.stage === 'completed').length) },
  ]

  return (
    <div className="mx-auto max-w-6xl space-y-12 px-6 py-12 md:px-16 md:py-16">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <h1 className="font-heading text-display font-extrabold leading-[1.02] tracking-tight text-foreground">
          Agent dashboard
        </h1>
        {pendingActions > 0 ? (
          <span
            className="inline-flex items-center gap-2 rounded-full border border-warning/40 bg-warning/15 px-3 py-1 text-medium text-warning"
            aria-label={`${pendingActions} pending actions`}
          >
            <span
              aria-hidden="true"
              className="inline-flex min-w-5 items-center justify-center rounded-full bg-warning/30 px-1.5 text-small font-semibold"
            >
              {pendingActions}
            </span>
            Pending actions
          </span>
        ) : (
          <span className="text-medium text-muted-foreground">No pending actions</span>
        )}
      </header>

      <SectionDivider label="Your numbers" />

      <StatStrip stats={stats} />

      <section aria-labelledby="clients-heading" className="space-y-6">
        <AccentHeading as="h2" id="clients-heading" className="text-large">
          Clients
        </AccentHeading>
        <ClientRoster clients={clientRows} onRevoke={revokeClientAction} />
      </section>

      <section id="pipeline" aria-labelledby="pipeline-heading" className="space-y-6">
        <AccentHeading as="h2" id="pipeline-heading" className="text-large">
          Deal pipeline
        </AccentHeading>
        <DealPipeline deals={deals} />
      </section>
    </div>
  )
}
