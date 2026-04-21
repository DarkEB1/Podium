import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getUser } from '@/lib/supabase/auth'
import { getMatches } from '@/lib/supabase/messaging'
import MatchList from '@/components/messaging/match-list'
import type { Database } from '@/types/database'

type MatchRow = Database['public']['Tables']['matches']['Row']

export default async function AthleteMessagesPage() {
  const supabase = await createClient()
  const user = await getUser(supabase)
  if (!user) redirect('/auth')

  const matches = (await getMatches(supabase, user.id)) as MatchRow[]
  const active = matches.filter((m) => m.status === 'active')

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 space-y-6">
      <h1 className="text-2xl font-bold">Messages</h1>
      <MatchList matches={active} currentUserId={user.id} basePath="/athlete/messages" />
    </div>
  )
}
