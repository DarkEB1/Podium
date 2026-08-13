import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getUser } from '@/lib/supabase/auth'
import { getOwnProfile } from '@/lib/supabase/profiles'
import AgentProfileForm from '@/components/agent/agent-profile-form'
import { AccentHeading } from '@/components/ui/accent-heading'
import type { Database } from '@/types/database'
import { applyForVerificationAction } from './actions'

/**
 * M-1 — an authenticated route. `robots.ts` already disallows it, but a crawler
 * that follows a shared link never reads robots.txt, so say it here too.
 */
export const metadata: Metadata = {
  title: 'Your agency profile · Podium',
  description: 'How your agency appears to athletes, teams and brands on Podium.',
  robots: { index: false },
}


type AgentRow = Database['public']['Tables']['agent_profiles']['Row']

export default async function AgentProfilePage() {
  const supabase = await createClient()
  const user = await getUser(supabase)

  if (!user) redirect('/auth')
  if (user.role !== 'agent') redirect('/403')

  // getOwnProfile is typed as a union over every role's row; the (agent) layout
  // guarantees the agent shape here.
  const profile = (await getOwnProfile(supabase, user.id, 'agent')) as AgentRow | null

  if (!profile) {
    // Onboarding has not created the agent_profiles row yet.
    redirect('/agent/onboarding')
  }

  return (
    <div className="mx-auto max-w-2xl px-6 py-12 md:px-16 md:py-16">
      <header className="mb-10 max-w-[20ch]">
        <AccentHeading as="h1" className="text-display">
          Your agency profile
        </AccentHeading>
        <p className="mt-4 text-medium text-muted-foreground">
          How athletes and brands see your agency on Podium.
        </p>
      </header>
      <AgentProfileForm
        profile={profile}
        onApplyForVerification={applyForVerificationAction}
      />
    </div>
  )
}
