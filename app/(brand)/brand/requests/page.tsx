import type { Metadata } from 'next'
import { redirect } from 'next/navigation'

import { createClient } from '@/lib/supabase/server'
import { getUser } from '@/lib/supabase/auth'
import { getIncomingConnectionRequests, getSenderDisplayNames } from '@/lib/supabase/connections'
import { captureException } from '@/lib/observability'
import RequestsList from '@/components/discovery/requests-list'
import TrackInboxView from './track-inbox-view'
import { ROUTES } from '@/lib/routes'
import type { ConnectionRequestRow } from '@/lib/supabase/connections'

/**
 * B-1 follow-up — THE BRAND'S ACCEPT SURFACE.
 *
 * The only place in the product that SENDS a connection request is
 * `components/discovery/listing-card.tsx`, which posts
 * `recipient_id: listing.brand_user_id` — i.e. every request in the system is
 * addressed to a BRAND user. The only place that could ACCEPT one was
 * `/athlete/requests`, which lists requests where `recipient_id = me` for an
 * athlete. The two never met: brands had no inbox and no nav entry, so no
 * request was ever accepted, the `connection_requests_create_match` trigger
 * never fired, and messaging → proposals → contracts → payments were all
 * unreachable in practice.
 *
 * `app/(brand)/brand/requests/core-loop.test.ts` is the regression guard: it
 * asserts the role a send surface targets always has a matching accept surface.
 */

export const metadata: Metadata = {
  title: 'Connection requests · Podium',
  description:
    'Review and respond to connection requests from athletes and teams who want to work with your brand.',
}

export default async function BrandRequestsPage() {
  const supabase = await createClient()
  const user = await getUser(supabase)
  if (!user) redirect(ROUTES.auth.signIn)

  let requests: ConnectionRequestRow[] = []
  let senderNames: Record<string, string> = {}
  try {
    requests = await getIncomingConnectionRequests(supabase, user.id)
    // Resolve who is asking — the card must never show a raw UUID. Four
    // queries total regardless of how many requests are pending.
    senderNames = await getSenderDisplayNames(
      supabase,
      requests.map((r) => r.sender_id)
    )
  } catch (error) {
    // A failed inbox read must not blank the page with an unexplained boundary:
    // report it (structured, no PII) and render the empty state.
    captureException(error, { route: ROUTES.brand.requests, role: 'brand' })
  }

  return (
    <div className="mx-auto max-w-3xl space-y-10 px-6 py-12 md:px-16 md:py-16">
      <TrackInboxView role="brand" pending={requests.length} />
      <div>
        <h1 className="font-heading text-display tracking-tight text-foreground">
          Connection requests
        </h1>
        <p className="mt-3 text-medium text-muted-foreground">
          {requests.length} pending
        </p>
      </div>

      {/* RequestsList's empty state is now role-agnostic and takes its copy and
          CTA from the caller, so the brand inbox no longer needs to duplicate
          it — and its CTA no longer points a brand at /athlete/discover. */}
      <RequestsList
        requests={requests}
        senderNames={senderNames}
        viewerRole="brand"
        emptyDescription="When an athlete or team responds to one of your listings, their request appears here for you to accept or decline. Accepting opens a conversation."
        emptyAction={{ label: 'Post a listing', href: ROUTES.brand.listingsNew }}
      />
    </div>
  )
}
