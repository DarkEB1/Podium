'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { ROUTES } from '@/lib/routes'
import { track } from '@/lib/analytics'
import type { Database } from '@/types/database'

type ConnectionRequestRow = Database['public']['Tables']['connection_requests']['Row']

interface Props {
  request: ConnectionRequestRow
  onResponded: () => void
  /**
   * Sender's display name. Optional so existing call sites keep compiling, but
   * pass it wherever you can — without it the card falls back to a generic
   * label rather than the raw UUID it used to print.
   */
  senderName?: string | undefined
  /**
   * M-6 — the role of the person RESPONDING (the inbox owner), used as the
   * `role` property of `connection_request_responded`. Optional so existing
   * call sites keep compiling; falls back to `unknown` rather than guessing.
   */
  viewerRole?: string | undefined
}

export default function ConnectionRequestCard({
  request,
  onResponded,
  senderName,
  viewerRole,
}: Props) {
  const [loading, setLoading] = useState<'accepted' | 'declined' | null>(null)

  async function respond(action: 'accepted' | 'declined') {
    setLoading(action)
    try {
      const res = await fetch(ROUTES.api.discovery.connection(request.id), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      })
      // PR-19: an unparseable body used to throw past the caller, so a failed
      // accept looked like nothing happening at all.
      const data = (await res.json().catch(() => ({}))) as { error?: { message?: string } }
      if (!res.ok) {
        toast.error(
          data.error?.message ??
            `Could not ${action === 'accepted' ? 'accept' : 'decline'} this request. Please try again.`,
        )
        return
      }
      // M-6 `connection_request_responded` — after the PATCH succeeded.
      // Acceptance is what creates a match, so this is the funnel's hinge.
      // Only the responder's role and the outcome enum leave the browser.
      track('connection_request_responded', { role: viewerRole ?? 'unknown', outcome: action })
      toast.success(action === 'accepted' ? 'Request accepted, you can now message them' : 'Request declined')
      onResponded()
    } catch {
      toast.error('Could not reach Podium. Please check your connection and try again.')
    } finally {
      setLoading(null)
    }
  }

  return (
    <div className="space-y-4 rounded-2xl border border-border bg-card p-8 shadow-sm">
      <div>
        {/*
          Was: a hardcoded "Connection request from brand" over the raw
          sender_id UUID. Both were wrong — every request in the product today
          is addressed TO a brand, so the sender is an athlete or team, and a
          UUID tells the recipient nothing about who is asking.
        */}
        <p className="text-small text-muted-foreground">Connection request</p>
        <p className="text-medium font-medium text-foreground">
          {senderName ?? 'Podium member'}
        </p>
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
