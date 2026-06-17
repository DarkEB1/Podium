'use client'

import { useState } from 'react'
import { Inbox } from 'lucide-react'
import ConnectionRequestCard from './connection-request-card'
import { EmptyState } from '@/components/ui/empty-state'
import type { Database } from '@/types/database'

type ConnectionRequestRow = Database['public']['Tables']['connection_requests']['Row']

interface Props { requests: ConnectionRequestRow[] }

export default function RequestsList({ requests: initial }: Props) {
  const [requests, setRequests] = useState(initial)

  function handleResponded(id: string) {
    setRequests((prev) => prev.filter((r) => r.id !== id))
  }

  if (requests.length === 0) {
    return (
      <EmptyState
        icon={<Inbox aria-hidden="true" />}
        title="No pending connection requests"
        description="When a brand sends you a connection request, it will appear here for you to accept or decline."
        action={{ label: 'Discover brands', href: '/athlete/discover' }}
      />
    )
  }

  return (
    <div className="space-y-6">
      {requests.map((req) => (
        <ConnectionRequestCard
          key={req.id}
          request={req}
          onResponded={() => handleResponded(req.id)}
        />
      ))}
    </div>
  )
}
