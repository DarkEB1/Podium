'use server'

import { createClient } from '@/lib/supabase/server'
import { getUser } from '@/lib/supabase/auth'
import { getOwnProfile } from '@/lib/supabase/profiles'
import { applyForVerification } from '@/lib/supabase/agents'

/**
 * Server action backing AG1's "Apply for Verification" CTA. It re-derives the
 * caller's own agent profile id server-side (never trusting a client-supplied
 * id beyond cross-checking it) and delegates to B9 `applyForVerification`,
 * which moves the row into the 'pending' queue. RLS scopes the update.
 */
export async function applyForVerificationAction(agentId: string): Promise<void> {
  const supabase = await createClient()
  const user = await getUser(supabase)

  if (!user || user.role !== 'agent') {
    throw new Error('Not authorised to request verification')
  }

  const profile = await getOwnProfile(supabase, user.id, 'agent')
  if (!profile || profile.id !== agentId) {
    throw new Error('Agent profile not found')
  }

  await applyForVerification(supabase, agentId)
}
