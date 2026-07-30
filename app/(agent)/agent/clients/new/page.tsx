import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Users } from 'lucide-react'

import { createClient } from '@/lib/supabase/server'
import { getUser } from '@/lib/supabase/auth'
import {
  getActiveAthleteProfiles,
  getActiveTeamProfiles,
  getOwnProfile,
} from '@/lib/supabase/profiles'
import { getAgentClients } from '@/lib/supabase/agents'
import { EmptyState } from '@/components/ui/empty-state'
import { buttonVariants } from '@/components/ui/button'
import { ROUTES } from '@/lib/routes'
import type { Database } from '@/types/database'

import RepresentButton from './represent-button'

/**
 * M-1 — an authenticated route. `robots.ts` already disallows it, but a crawler
 * that follows a shared link never reads robots.txt, so say it here too.
 */
export const metadata: Metadata = {
  title: 'Add a client · Podium',
  description: 'Invite an athlete or team to be represented by your agency.',
  robots: { index: false },
}


type AgentRow = Database['public']['Tables']['agent_profiles']['Row']

/** One row of the picker, normalised across the two kinds of client. */
interface Candidate {
  key: string
  userId: string
  name: string
  detail: string
  role: 'athlete' | 'team'
}

/**
 * B-4 — the agent role CTA ("Add Client") pointed at `/agent/clients/new`,
 * which did not exist. Representation starts from the client: the agent picks a
 * published athlete or team and sends a representation request, which the client
 * then accepts (`POST /api/profiles/representation`).
 *
 * Teams are listed alongside athletes because agents represent both. The API and
 * the `representation_links.client_role` column have always accepted 'team';
 * only this UI was athlete-only, so half of the agent proposition had no way to
 * be used at all.
 */
export default async function AddAgentClientPage() {
  const supabase = await createClient()
  const user = await getUser(supabase)
  if (!user) redirect(ROUTES.auth.signIn)
  if (user.role !== 'agent') redirect(ROUTES.forbidden)

  // getOwnProfile returns the role union; role 'agent' narrows it to AgentRow.
  const profile = (await getOwnProfile(supabase, user.id, 'agent')) as AgentRow | null
  if (!profile) redirect(ROUTES.agent.onboarding)

  const [athletes, teams, links] = await Promise.all([
    getActiveAthleteProfiles(supabase),
    getActiveTeamProfiles(supabase),
    getAgentClients(supabase, profile.id),
  ])
  const linkedUserIds = new Set(links.map((l) => l.client_user_id))

  const candidates: Candidate[] = [
    ...athletes.map((a) => ({
      key: `athlete-${a.id}`,
      userId: a.user_id,
      name: a.display_name ?? 'Athlete',
      detail: [a.primary_sport, a.home_city].filter(Boolean).join(' · '),
      role: 'athlete' as const,
    })),
    ...teams.map((t) => ({
      key: `team-${t.id}`,
      userId: t.user_id,
      name: t.team_name ?? 'Team',
      detail: [t.sports?.[0], t.home_city].filter(Boolean).join(' · '),
      role: 'team' as const,
    })),
  ]

  return (
    <div className="mx-auto max-w-4xl space-y-10 px-6 py-12 md:px-16 md:py-16">
      <header className="space-y-3">
        <h1 className="font-heading text-display font-extrabold tracking-tight text-foreground">
          Add a client
        </h1>
        <p className="max-w-[52ch] text-medium text-muted-foreground">
          Send a representation request to a published athlete or team. They will see it on their
          profile and can accept or decline. Representation only starts once they accept.
        </p>
        <Link href={ROUTES.agent.clients} className={buttonVariants({ variant: 'ghost', size: 'sm' })}>
          Back to clients
        </Link>
      </header>

      {candidates.length === 0 ? (
        <EmptyState
          icon={<Users aria-hidden="true" />}
          title="No published athletes or teams yet"
          description="When athletes and teams publish their profiles they will appear here and you can ask to represent them."
        />
      ) : (
        <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
          {candidates.map((candidate) => (
            <li key={candidate.key} className="flex items-center justify-between gap-4 px-6 py-4">
              <div className="min-w-0">
                <Link
                  href={`${ROUTES.agent.profile}/${candidate.userId}`}
                  className="truncate text-medium font-medium text-foreground hover:underline"
                >
                  {candidate.name}
                </Link>
                {/* The kind is always stated: a roster mixes both, and a name on
                    its own does not say whether it is a club or a person. */}
                <p className="truncate text-small text-muted-foreground">
                  {[candidate.role === 'team' ? 'Team' : 'Athlete', candidate.detail]
                    .filter(Boolean)
                    .join(' · ')}
                </p>
              </div>
              <RepresentButton
                clientUserId={candidate.userId}
                clientName={candidate.name}
                clientRole={candidate.role}
                alreadyLinked={linkedUserIds.has(candidate.userId)}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
