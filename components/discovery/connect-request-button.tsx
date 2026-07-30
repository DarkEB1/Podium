'use client'

import { useState } from 'react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { CharacterCounter } from '@/components/ui/character-counter'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { ROUTES } from '@/lib/routes'
import { CONNECTION_MESSAGE_MIN, CONNECTION_MESSAGE_MAX } from '@/lib/limits'
import { track } from '@/lib/analytics'

interface Props {
  /** The recipient's **user** id, not their profile id: the FK points at users. */
  recipientUserId: string
  /** Shown in the dialog so the sender can see who they are writing to. */
  recipientName: string
  /** Recipient's role. Reported to analytics; never sent to the API. */
  recipientRole: 'athlete' | 'team' | 'brand'
  /** Which page the request came from, for analytics. */
  surface: string
  /**
   * Set when the recipient is not currently taking requests. The button stays
   * visible and explains itself rather than disappearing, so the reason is
   * discoverable.
   */
  unavailableReason?: string
}

/**
 * Sends a connection request to one athlete, team or brand.
 *
 * Built because the detail pages a brand reaches from discovery had no way to
 * act. `/brand/discover/[userId]` and `/brand/discover/team/[userId]` rendered a
 * profile and a "Back" link and nothing else, so a brand could look at an
 * athlete or a team and had no route to contacting them anywhere in the UI. The
 * routing 404s were fixed before this; the action the routes exist to offer was
 * still missing.
 *
 * Deliberately the same contract as `components/discovery/listing-card.tsx`,
 * which is the working example on the athlete side: same endpoint, same length
 * bounds from `lib/limits.ts`, same "parse defensively and always surface a
 * failure" handling.
 */
export default function ConnectRequestButton({
  recipientUserId,
  recipientName,
  recipientRole,
  surface,
  unavailableReason,
}: Props) {
  const [open, setOpen] = useState(false)
  const [message, setMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)

  const trimmedLength = message.trim().length
  const tooShort = trimmedLength < CONNECTION_MESSAGE_MIN
  const tooLong = trimmedLength > CONNECTION_MESSAGE_MAX
  const canSend = !tooShort && !tooLong && !sending

  async function sendRequest() {
    setSending(true)
    try {
      const res = await fetch(ROUTES.api.discovery.connections, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recipient_id: recipientUserId, message: message.trim() }),
      })
      // A non-JSON body (an HTML error page, a dropped connection) must not throw
      // out of this handler: that leaves the dialog open with no explanation.
      const data = (await res.json().catch(() => ({}))) as { error?: { message?: string } }
      if (!res.ok) {
        toast.error(data.error?.message ?? 'Could not send your request. Please try again.')
        return
      }
      // Fired only after a 2xx. The message body and the recipient id are
      // deliberately never sent to analytics.
      track('connection_request_sent', { recipient_role: recipientRole, surface })
      toast.success('Connection request sent')
      setSent(true)
      setOpen(false)
      setMessage('')
    } catch {
      toast.error('Could not send your request. Please check your connection and try again.')
    } finally {
      setSending(false)
    }
  }

  if (unavailableReason) {
    return (
      <div className="rounded-2xl border border-border bg-muted p-6">
        <p className="text-medium text-muted-foreground">{unavailableReason}</p>
      </div>
    )
  }

  return (
    <>
      <Button type="button" onClick={() => setOpen(true)} disabled={sent}>
        {sent ? 'Request sent' : 'Send connection request'}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Contact {recipientName}</DialogTitle>
            <DialogDescription>
              They will see your message with the request and can accept or decline it.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <label htmlFor="connect-message" className="block text-medium font-medium">
              Personalised message
            </label>
            <p className="text-small text-muted-foreground">
              Say who you are and what you are proposing, between{' '}
              {CONNECTION_MESSAGE_MIN} and {CONNECTION_MESSAGE_MAX} characters.
            </p>
            <Textarea
              id="connect-message"
              rows={6}
              maxLength={CONNECTION_MESSAGE_MAX}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              aria-invalid={tooShort || tooLong}
              aria-describedby="connect-message-status"
              placeholder="Introduce your brand, the campaign you have in mind and what you are offering…"
            />
            <div className="flex items-center justify-between">
              <span
                id="connect-message-status"
                role={tooLong ? 'alert' : undefined}
                className={
                  tooShort || tooLong
                    ? 'text-small font-medium text-destructive'
                    : 'text-small text-success'
                }
              >
                {tooLong
                  ? `Keep it to ${CONNECTION_MESSAGE_MAX} characters or fewer`
                  : tooShort
                    ? `Write at least ${CONNECTION_MESSAGE_MIN} characters`
                    : 'Ready to send'}
              </span>
              <CharacterCounter value={message} max={CONNECTION_MESSAGE_MAX} />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="button" onClick={sendRequest} disabled={!canSend}>
              {sending ? 'Sending…' : 'Send request'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
