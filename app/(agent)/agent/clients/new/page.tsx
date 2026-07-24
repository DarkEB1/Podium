import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Users } from 'lucide-react'

import { createClient } from '@/lib/supabase/server'
import { getUser } from '@/lib/supabase/auth'
import { getActiveAthleteProfiles, getOwnProfile } from '@/lib/supabase/profiles'
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

/**
 * B-4 — the agent role CTA ("Add Client") pointed at `/agent/clients/new`,
 * which did not exist. Representation starts from the athlete: the agent picks
 * a published athlete and sends a representation request, which the athlete
 * then accepts (`POST /api/profiles/representation`).
 */
export default async function AddAgentClientPage() {
  const supabase = await createClient()
  const user = await getUser(supabase)
  if (!user) redirect(ROUTES.auth.signIn)
  if (user.role !== 'agent') redirect(ROUTES.forbidden)

  // getOwnProfile returns the role union; role 'agent' narrows it to AgentRow.
  const profile = (await getOwnProfile(supabase, user.id, 'agent')) as AgentRow | null
  if (!profile) redirect(ROUTES.agent.onboarding)

  const [athletes, links] = await Promise.all([
    getActiveAthleteProfiles(supabase),
    getAgentClients(supabase, profile.id),
  ])
  const linkedUserIds = new Set(links.map((l) => l.client_user_id))

  return (
    <div className="mx-auto max-w-4xl space-y-10 px-6 py-12 md:px-16 md:py-16">
      <header className="space-y-3">
        <h1 className="font-heading text-display font-extrabold tracking-tight text-foreground">
          Add a client
        </h1>
        <p className="max-w-[52ch] text-medium text-muted-foreground">
          Send a representation request to a published athlete. They will see it on their profile
          and can accept or decline — representation only starts once they accept.
        </p>
        <Link href={ROUTES.agent.clients} className={buttonVariants({ variant: 'ghost', size: 'sm' })}>
          Back to clients
        </Link>
      </header>

      {athletes.length === 0 ? (
        <EmptyState
          icon={<Users aria-hidden="true" />}
          title="No published athletes yet"
          description="When athletes publish their profiles they will appear here and you can ask to represent them."
        />
      ) : (
        <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
          {athletes.map((athlete) => {
            const name = athlete.display_name ?? 'Athlete'
            const detail = [athlete.primary_sport, athlete.home_city].filter(Boolean).join(' · ')
            return (
              <li key={athlete.id} className="flex items-center justify-between gap-4 px-6 py-4">
                <div className="min-w-0">
                  <Link
                    href={ROUTES.agent.profile + `/${athlete.user_id}`}
                    className="truncate text-medium font-medium text-foreground hover:underline"
                  >
                    {name}
                  </Link>
                  {detail ? (
                    <p className="truncate text-small text-muted-foreground">{detail}</p>
                  ) : null}
                </div>
                <RepresentButton
                  clientUserId={athlete.user_id}
                  clientName={name}
                  alreadyLinked={linkedUserIds.has(athlete.user_id)}
                />
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
