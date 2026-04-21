'use client'

import { useState } from 'react'
import ConnectionRequestCard from './connection-request-card'
import type { Database } from '@/types/database'

type ConnectionRequestRow = Database['public']['Tables']['connection_requests']['Row']

interface Props { requests: ConnectionRequestRow[] }

export default function RequestsList({ requests: initial }: Props) {
  const [requests, setRequests] = useState(initial)

  function handleResponded(id: string) {
    setRequests((prev) => prev.filter((r) => r.id !== id))
  }

  if (requests.length === 0) {
    return <p className="text-center text-muted-foreground py-12">No pending connection requests.</p>
  }

  return (
    <div className="space-y-4">
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
