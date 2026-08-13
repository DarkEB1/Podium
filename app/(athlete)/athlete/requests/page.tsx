import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getUser } from '@/lib/supabase/auth'
import { getIncomingConnectionRequests, getSenderDisplayNames } from '@/lib/supabase/connections'
import { captureException } from '@/lib/observability'
import RequestsList from '@/components/discovery/requests-list'
import { ROUTES } from '@/lib/routes'
import type { ConnectionRequestRow } from '@/lib/supabase/connections'
import { AccentHeading } from '@/components/ui/accent-heading'

export const metadata: Metadata = {
  title: 'Connection requests · Podium',
  description: 'Accept or decline the brands who want to work with you.',
}

export default async function AthleteRequestsPage() {
  const supabase = await createClient()
  const user = await getUser(supabase)
  if (!user) redirect(ROUTES.auth.signIn)

  // SB-10/FA-1/FA-8: this page used to select every column of the
  // connection-requests table inline — a Supabase call outside lib/supabase/,
  // which CLAUDE.md forbids, and the reason
  // the same query had to be re-invented for every other role's inbox. The
  // accessor is role-agnostic (recipient_id is a FK to users.id) and projects
  // its columns explicitly.
  let requests: ConnectionRequestRow[] = []
  let senderNames: Record<string, string> = {}
  try {
    requests = await getIncomingConnectionRequests(supabase, user.id)
    senderNames = await getSenderDisplayNames(
      supabase,
      requests.map((r) => r.sender_id)
    )
  } catch (error) {
    captureException(error, { route: ROUTES.athlete.requests, role: 'athlete' })
  }

  return (
    <div className="mx-auto max-w-3xl space-y-10 px-6 py-12 md:px-16 md:py-16">
      <div>
        <AccentHeading as="h1" className="text-display">Connection requests</AccentHeading>
        <p className="mt-3 text-medium text-muted-foreground">{requests.length} pending</p>
      </div>
      <RequestsList
        requests={requests}
        senderNames={senderNames}
        viewerRole="athlete"
        emptyDescription="When a brand wants to work with you, their request appears here for you to accept or decline."
        emptyAction={{ label: 'Discover opportunities', href: ROUTES.athlete.discover }}
      />
    </div>
  )
}
