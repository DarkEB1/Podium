import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getUser } from '@/lib/supabase/auth'
import { getOwnProfile } from '@/lib/supabase/profiles'
import AgentProfileForm from '@/components/agent/agent-profile-form'
import type { Database } from '@/types/database'
import { applyForVerificationAction } from './actions'

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
    <div className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="mb-6 font-heading text-large font-bold">Your agency profile</h1>
      <AgentProfileForm
        profile={profile}
        onApplyForVerification={applyForVerificationAction}
      />
    </div>
  )
}
