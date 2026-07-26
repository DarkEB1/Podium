'use client'

import { useState } from 'react'
import { Inbox } from 'lucide-react'
import ConnectionRequestCard from './connection-request-card'
import { EmptyState } from '@/components/ui/empty-state'
import { ROUTES } from '@/lib/routes'
import type { Database } from '@/types/database'

type ConnectionRequestRow = Database['public']['Tables']['connection_requests']['Row']

interface Props {
  requests: ConnectionRequestRow[]
  /**
   * Sender display names keyed by user id. Without this the cards fall back to
   * a generic label — they must never print a raw UUID at the recipient.
   */
  senderNames?: Record<string, string>
  /**
   * Empty-state copy and CTA. This component is mounted by BOTH the athlete and
   * the brand inbox, so it cannot assume who the counterparty is: the copy used
   * to say "when a brand sends you a connection request" and link to
   * `/athlete/discover`, which the (athlete) layout bounces a brand to /403.
   */
  emptyDescription?: string
  emptyAction?: { label: string; href: string }
  /** M-6 — role of the inbox owner, forwarded to the response event. */
  viewerRole?: string | undefined
}

const DEFAULT_EMPTY_DESCRIPTION =
  'When someone sends you a connection request, it will appear here for you to accept or decline.'

export default function RequestsList({
  requests: initial,
  senderNames,
  emptyDescription = DEFAULT_EMPTY_DESCRIPTION,
  emptyAction = { label: 'Discover opportunities', href: ROUTES.athlete.discover },
  viewerRole,
}: Props) {
  const [requests, setRequests] = useState(initial)

  function handleResponded(id: string) {
    setRequests((prev) => prev.filter((r) => r.id !== id))
  }

  if (requests.length === 0) {
    return (
      <EmptyState
        icon={<Inbox aria-hidden="true" />}
        title="No pending connection requests"
        description={emptyDescription}
        action={emptyAction}
      />
    )
  }

  return (
    <div className="space-y-6">
      {requests.map((req) => (
        <ConnectionRequestCard
          key={req.id}
          request={req}
          senderName={senderNames?.[req.sender_id]}
          viewerRole={viewerRole}
          onResponded={() => handleResponded(req.id)}
        />
      ))}
    </div>
  )
}
