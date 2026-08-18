'use client'

import { useState } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import { Button, buttonVariants } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ROUTES } from '@/lib/routes'
import { track } from '@/lib/analytics'
import { cn } from '@/lib/utils'
import type { Database } from '@/types/database'

type ConnectionRequestRow = Database['public']['Tables']['connection_requests']['Row']

// Read-only labels for a request the recipient has already acted on (or the
// sender has withdrawn). `pending` is deliberately absent: a pending request
// renders its Accept/Decline controls, never a status pill.
const RESOLVED_STATUS_LABEL: Record<string, string> = {
  accepted: 'Accepted',
  declined: 'Declined',
  withdrawn: 'Withdrawn',
}

interface Props {
  request: ConnectionRequestRow
  /**
   * Called after a pending request is accepted/declined so the list can drop it.
   * Optional because a resolved (accepted/declined) card is read-only and never
   * responds.
   */
  onResponded?: (() => void) | undefined
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
  /**
   * Where an ACCEPTED request hands off to (the viewer's Messages inbox). When
   * set, an accepted card shows a "Message them" link so a request that leaves
   * the pending queue still has somewhere to go, instead of vanishing.
   */
  messagesHref?: string | undefined
}

export default function ConnectionRequestCard({
  request,
  onResponded,
  senderName,
  viewerRole,
  messagesHref,
}: Props) {
  const [loading, setLoading] = useState<'accept' | 'decline' | null>(null)
  const isPending = request.status === 'pending'

  // `action` values are the API's imperative contract — the PATCH route only
  // accepts 'accept' | 'decline' | 'withdraw'; the past-tense row statuses
  // ('accepted'/'declined') are what the server writes, not what it receives.
  async function respond(action: 'accept' | 'decline') {
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
            `Could not ${action} this request. Please try again.`,
        )
        return
      }
      // M-6 `connection_request_responded` — after the PATCH succeeded.
      // Acceptance is what creates a match, so this is the funnel's hinge.
      // Only the responder's role and the outcome enum leave the browser.
      // `outcome` keeps the past-tense enum this event has always emitted.
      track('connection_request_responded', {
        role: viewerRole ?? 'unknown',
        outcome: action === 'accept' ? 'accepted' : 'declined',
      })
      toast.success(action === 'accept' ? 'Request accepted, you can now message them' : 'Request declined')
      onResponded?.()
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
      {isPending ? (
        <div className="flex gap-2">
          <Button
            size="sm"
            onClick={() => respond('accept')}
            disabled={loading !== null}
          >
            {loading === 'accept' ? 'Accepting…' : 'Accept'}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => respond('decline')}
            disabled={loading !== null}
          >
            {loading === 'decline' ? 'Declining…' : 'Decline'}
          </Button>
        </div>
      ) : (
        // Resolved request: read-only. The status pill confirms the outcome so an
        // acted-on request has a visible record, and an accepted one hands off to
        // Messages rather than dead-ending.
        <div className="flex flex-wrap items-center gap-3">
          <Badge variant={request.status === 'accepted' ? 'secondary' : 'outline'}>
            {RESOLVED_STATUS_LABEL[request.status] ?? request.status}
          </Badge>
          {request.status === 'accepted' && messagesHref ? (
            <Link
              href={messagesHref}
              className={cn(buttonVariants({ variant: 'outline', size: 'sm' }))}
            >
              Message them
            </Link>
          ) : null}
        </div>
      )}
    </div>
  )
}
