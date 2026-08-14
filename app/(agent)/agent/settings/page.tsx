import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getUser } from '@/lib/supabase/auth'
import { getOwnProfile } from '@/lib/supabase/profiles'
import { getSettings } from '@/lib/supabase/settings'
import AgentSettingsForm from '@/components/agent/agent-settings-form'
import type { Database } from '@/types/database'

/**
 * M-1 — an authenticated route. `robots.ts` already disallows it, but a crawler
 * that follows a shared link never reads robots.txt, so say it here too.
 */
export const metadata: Metadata = {
  title: 'Settings · Podium',
  description: 'Manage your Podium account, notifications and privacy.',
  robots: { index: false },
}


type AgentRow = Database['public']['Tables']['agent_profiles']['Row']

export default async function AgentSettingsPage() {
  const supabase = await createClient()
  const user = await getUser(supabase)

  if (!user) redirect('/auth')
  if (user.role !== 'agent') redirect('/403')

  // getOwnProfile is typed as a union over every role's row; the (agent) layout
  // guarantees the agent shape here.
  const profile = (await getOwnProfile(supabase, user.id, 'agent')) as AgentRow | null
  if (!profile) redirect('/agent/onboarding')

  // Settings may legitimately be absent until a row is provisioned; the form
  // falls back to visible defaults, so a fetch failure must not break the page.
  const settings = await getSettings(supabase, user.id).catch(() => null)

  return <AgentSettingsForm profile={profile} settings={settings} />
}
