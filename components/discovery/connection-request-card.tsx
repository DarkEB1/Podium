'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import type { Database } from '@/types/database'

type ConnectionRequestRow = Database['public']['Tables']['connection_requests']['Row']

interface Props {
  request: ConnectionRequestRow
  onResponded: () => void
}

export default function ConnectionRequestCard({ request, onResponded }: Props) {
  const [loading, setLoading] = useState<'accepted' | 'declined' | null>(null)

  async function respond(action: 'accepted' | 'declined') {
    setLoading(action)
    try {
      const res = await fetch(`/api/discovery/connections/${request.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error?.message ?? 'Failed'); return }
      toast.success(action === 'accepted' ? 'Request accepted — you can now message them' : 'Request declined')
      onResponded()
    } finally {
      setLoading(null)
    }
  }

  return (
    <div className="space-y-4 rounded-2xl border border-border bg-card p-8 shadow-sm">
      <div>
        <p className="text-small text-muted-foreground">Connection request from brand</p>
        <p className="font-mono text-small text-muted-foreground">{request.sender_id}</p>
      </div>
      <blockquote className="border-l-2 border-border pl-4 text-medium italic text-muted-foreground">
        {request.message}
      </blockquote>
      <p className="text-small text-muted-foreground">
        Received {new Date(request.sent_at).toLocaleDateString()}
      </p>
      <div className="flex gap-2">
        <Button
          size="sm"
          onClick={() => respond('accepted')}
          disabled={loading !== null}
        >
          {loading === 'accepted' ? 'Accepting…' : 'Accept'}
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => respond('declined')}
          disabled={loading !== null}
        >
          {loading === 'declined' ? 'Declining…' : 'Decline'}
        </Button>
      </div>
    </div>
  )
}
