import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Inbox } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { getUser } from '@/lib/supabase/auth'
import { getIncomingConnectionRequests, getSenderDisplayNames } from '@/lib/supabase/connections'
import { captureException } from '@/lib/observability'
import RequestsList from '@/components/discovery/requests-list'
import ConnectionRequestCard from '@/components/discovery/connection-request-card'
import { ROUTES } from '@/lib/routes'
import type { ConnectionRequestRow } from '@/lib/supabase/connections'
import { AccentHeading } from '@/components/ui/accent-heading'
import { buttonVariants } from '@/components/ui/button'
import { Icon } from '@/components/ui/icon'
import { cn } from '@/lib/utils'
import type { Database } from '@/types/database'

export const metadata: Metadata = {
  title: 'Connection requests · Podium',
  description: 'Accept or decline the brands who want to work with you.',
}

type ConnectionStatus = Database['public']['Enums']['connection_status']

/**
 * REQ1 — the inbound buckets an athlete can act on or review. Before this, only
 * `pending` was reachable, so an accepted or declined request vanished the
 * moment it left the queue with no history and no confirmation. `withdrawn` is a
 * sender-side outcome, so it is intentionally absent from the recipient's tabs.
 */
const STATUS_TABS = [
  { key: 'pending', label: 'Pending' },
  { key: 'accepted', label: 'Accepted' },
  { key: 'declined', label: 'Declined' },
] as const satisfies readonly { key: ConnectionStatus; label: string }[]

type TabKey = (typeof STATUS_TABS)[number]['key']

function isTabKey(value: string | undefined): value is TabKey {
  return STATUS_TABS.some((tab) => tab.key === value)
}

function tabHref(key: TabKey): string {
  // Pending is the default view, so it owns the bare route (no ?status noise).
  return key === 'pending' ? ROUTES.athlete.requests : `${ROUTES.athlete.requests}?status=${key}`
}

export default async function AthleteRequestsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>
}) {
  const supabase = await createClient()
  const user = await getUser(supabase)
  if (!user) redirect(ROUTES.auth.signIn)

  const { status } = await searchParams
  const activeStatus: TabKey = isTabKey(status) ? status : 'pending'

  // SB-10/FA-1/FA-8: reads go through lib/supabase/. `getIncomingConnectionRequests`
  // already takes a status option, so segmentation is a filter over the same
  // role-agnostic accessor, not a new query per bucket.
  let requests: ConnectionRequestRow[] = []
  let senderNames: Record<string, string> = {}
  try {
    requests = await getIncomingConnectionRequests(supabase, user.id, { status: activeStatus })
    senderNames = await getSenderDisplayNames(
      supabase,
      requests.map((r) => r.sender_id)
    )
  } catch (error) {
    captureException(error, { route: ROUTES.athlete.requests, role: 'athlete' })
  }

  const activeLabel = STATUS_TABS.find((tab) => tab.key === activeStatus)!.label

  return (
    <div className="mx-auto max-w-3xl space-y-10 px-6 py-12 md:px-16 md:py-16">
      <div>
        <AccentHeading as="h1" className="text-display">Connection requests</AccentHeading>
        {/*
          REQ3: the counter now names the active bucket ("3 accepted"), so it is
          meaningful rather than a bare "0 pending" implying unreachable buckets.
          It hides when the bucket is empty — the empty state carries that case.
        */}
        {requests.length > 0 ? (
          <p className="mt-3 text-medium text-muted-foreground">
            {requests.length} {activeLabel.toLowerCase()}
          </p>
        ) : null}
      </div>

      {/* REQ1: real status segmentation, styled like the app's other filter rows. */}
      <div role="tablist" aria-label="Filter requests by status" className="flex flex-wrap gap-2">
        {STATUS_TABS.map((tab) => {
          const active = tab.key === activeStatus
          return (
            <Link
              key={tab.key}
              role="tab"
              aria-selected={active}
              href={tabHref(tab.key)}
              className={cn(buttonVariants({ variant: active ? 'default' : 'outline', size: 'sm' }))}
            >
              {tab.label}
            </Link>
          )
        })}
      </div>

      {requests.length === 0 ? (
        <EmptyBucket status={activeStatus} />
      ) : activeStatus === 'pending' ? (
        // Pending is the only interactive bucket: the client list handles the
        // optimistic removal after an accept/decline.
        <RequestsList requests={requests} senderNames={senderNames} viewerRole="athlete" />
      ) : (
        // Accepted / declined are history: read-only cards, with the accepted
        // ones handing off to Messages.
        <div className="space-y-6">
          {requests.map((req) => (
            <ConnectionRequestCard
              key={req.id}
              request={req}
              senderName={senderNames[req.sender_id]}
              viewerRole="athlete"
              messagesHref={ROUTES.athlete.messages}
            />
          ))}
        </div>
      )}
    </div>
  )
}

/**
 * Per-bucket empty state. The pending bucket (REQ2) does more than the old
 * single outbound CTA: it says what actually drives inbound requests and offers
 * two ranked actions — finish your profile so brands can find you (primary),
 * and go looking yourself (secondary). Accepted/declined are quiet history
 * confirmations.
 */
function EmptyBucket({ status }: { status: TabKey }) {
  const copy: Record<TabKey, { title: string; description: string }> = {
    pending: {
      title: 'No pending requests',
      description:
        'Brands reach out once they can find you. Finish your profile to get discovered, or go find opportunities yourself.',
    },
    accepted: {
      title: 'No accepted requests yet',
      description: 'Requests you accept show up here, with a link straight to the conversation.',
    },
    declined: {
      title: 'No declined requests',
      description: 'Requests you decline are kept here so nothing disappears without a trace.',
    },
  }

  const { title, description } = copy[status]

  return (
    <div className="flex flex-col items-center justify-center gap-3 px-4 py-16 text-center">
      <div
        aria-hidden="true"
        className="mb-2 flex size-16 items-center justify-center rounded-full bg-primary/10 text-primary [&_svg]:size-7"
      >
        <Icon icon={Inbox} size={28} />
      </div>
      <h2 className="text-large font-heading text-foreground">{title}</h2>
      <p className="text-medium max-w-prose text-muted-foreground">{description}</p>
      {status === 'pending' ? (
        <div className="mt-2 flex flex-wrap items-center justify-center gap-3">
          <Link
            href={ROUTES.athlete.settings}
            className={cn(buttonVariants({ variant: 'default', size: 'lg' }))}
          >
            Complete your profile
          </Link>
          <Link
            href={ROUTES.athlete.discover}
            className={cn(buttonVariants({ variant: 'outline', size: 'lg' }))}
          >
            Discover opportunities
          </Link>
        </div>
      ) : null}
    </div>
  )
}
