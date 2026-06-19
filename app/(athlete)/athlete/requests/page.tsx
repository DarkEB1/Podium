import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getUser } from '@/lib/supabase/auth'
import RequestsList from '@/components/discovery/requests-list'
import type { Database } from '@/types/database'
import type { SupabaseClient } from '@supabase/supabase-js'

type ConnectionRequestRow = Database['public']['Tables']['connection_requests']['Row']

export default async function AthleteRequestsPage() {
  const supabase = await createClient()
  const user = await getUser(supabase)
  if (!user) redirect('/auth')

  // Tech debt: no lib/supabase wrapper for incoming connection requests.
  // Direct query here until GET /api/discovery/connections/incoming is added.
  const { data } = await (supabase as SupabaseClient)
    .from('connection_requests')
    .select('*')
    .eq('recipient_id', user.id)
    .eq('status', 'pending')
    .order('sent_at', { ascending: false })

  const requests = (data ?? []) as ConnectionRequestRow[]

  return (
    <div className="mx-auto max-w-3xl space-y-10 px-6 py-12 md:px-16 md:py-16">
      <div>
        <h1 className="font-heading text-display tracking-tight text-foreground">Connection requests</h1>
        <p className="mt-3 text-medium text-muted-foreground">{requests.length} pending</p>
      </div>
      <RequestsList requests={requests} />
    </div>
  )
}
