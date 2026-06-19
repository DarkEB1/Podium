'use server'

import { createClient } from '@/lib/supabase/server'
import { getUser } from '@/lib/supabase/auth'
import { getOwnProfile } from '@/lib/supabase/profiles'
import { getAgentClients } from '@/lib/supabase/agents'

/**
 * Server action backing the client table's "Revoke Access" quick action.
 *
 * It re-derives the caller's own agent profile server-side and confirms the
 * link belongs to this agent before doing anything (never trusting the
 * client-supplied id beyond cross-checking it against the agent's own roster).
 *
 * NOTE (follow-up): there is no agent-side termination primitive in
 * `lib/supabase/*` yet — `respondRepresentationLink` only matches on
 * `client_user_id` (the client revoking the agent), and per the execution
 * rules this pod must not add helpers to `lib/`. Until Track B ships an
 * agent-side `revokeClientLink` (and a matching RLS policy / API route), this
 * action validates ownership and throws so the UI surfaces a clear message
 * rather than silently no-op'ing. See the returned follow-up.
 */
export async function revokeClientAction(linkId: string): Promise<void> {
  const supabase = await createClient()
  const user = await getUser(supabase)

  if (!user || user.role !== 'agent') {
    throw new Error('Not authorised to revoke client access')
  }

  const profile = await getOwnProfile(supabase, user.id, 'agent')
  if (!profile) {
    throw new Error('Agent profile not found')
  }

  const clients = await getAgentClients(supabase, profile.id)
  const owns = clients.some((c) => c.id === linkId)
  if (!owns) {
    throw new Error('Representation link not found')
  }

  // Revoke primitive pending Track B. Surface a typed error for the toast layer.
  throw new Error(
    'Revoking client access is not available yet — this requires an agent-side termination endpoint.'
  )
}
