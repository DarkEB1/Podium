'use client'

import { useState } from 'react'
import { toast } from 'sonner'

import { CharacterCounter } from '@/components/ui/character-counter'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
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
import type { ListingSummary } from '@/lib/supabase/discovery'
import { track } from '@/lib/analytics'

import { BrandLockup, payDisplay, formatLevel } from './brand-visual'

interface Props {
  /** `JobListingWithBrand` and `ScoredListing` are supersets of `ListingSummary`. */
  listing: ListingSummary
  open: boolean
  onOpenChange: (open: boolean) => void
  /**
   * Which surface opened the composer. Recorded on `connection_request_sent`
   * (M-6) so the two entry points can be told apart. The message text and the
   * recipient id are deliberately never sent.
   */
  surface?: string
}

/**
 * The personalised connection-request composer, shared by the marketplace
 * listing card and the Live Board card-back so there is a single implementation
 * of the bounds, counter, tracking, POST and error handling (PR-8 / PR-19).
 *
 * Controlled: the caller owns `open` and renders its own trigger button, so the
 * composer can be opened from a card CTA or from a card-back action alike.
 */
export function ConnectionRequestDialog({ listing, open, onOpenChange, surface = 'listing_card' }: Props) {
  const [message, setMessage] = useState('')
  const [sending, setSending] = useState(false)
  // DISC3: keep the message field neutral until the athlete has interacted, so
  // it does not render in red error styling before they have typed anything.
  const [touched, setTouched] = useState(false)

  const subtitle = [listing.sport_required, formatLevel(listing.level_required)]
    .filter(Boolean)
    .join(' · ')

  const pay = payDisplay(listing)
  const brandName = listing.brand_name
  const brandLogo = listing.brand_logo_url

  const trimmedLength = message.trim().length
  const tooShort = trimmedLength < CONNECTION_MESSAGE_MIN
  const tooLong = trimmedLength > CONNECTION_MESSAGE_MAX
  // Show the error styling only once the athlete has engaged (DISC3).
  const showError = touched && (tooShort || tooLong)
  // PR-19: a listing whose brand profile could not be resolved has nobody to
  // send to. Disable rather than let the request fail its FK server-side.
  const canSend = !tooShort && !tooLong && listing.brand_user_id !== null

  async function sendRequest() {
    if (!listing.brand_user_id) return
    setSending(true)
    try {
      // PR-19: must be the brand's *user* id. `listing.brand_id` is a
      // brand_profiles.id and violates the recipient FK (see JobListingWithBrand).
      const res = await fetch(ROUTES.api.discovery.connections, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recipient_id: listing.brand_user_id, message: message.trim() }),
      })
      // PR-19: a non-JSON body (a 500 HTML page, a network drop) used to throw
      // out of this handler, leaving the dialog open with no feedback at all.
      // Every failure now surfaces to the user.
      const data = (await res.json().catch(() => ({}))) as { error?: { message?: string } }
      if (!res.ok) {
        toast.error(data.error?.message ?? 'Could not send your request. Please try again.')
        return
      }
      // M-6 `connection_request_sent`, fired only after a 2xx. The recipient
      // is always a brand on this surface; the message body and the recipient
      // id are deliberately NOT sent.
      track('connection_request_sent', { recipient_role: 'brand', surface })
      toast.success('Connection request sent')
      onOpenChange(false)
      setMessage('')
      setTouched(false)
    } catch {
      toast.error('Could not send your request. Please check your connection and try again.')
    } finally {
      setSending(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          {/* DISC1: identify the brand prominently in the request header. */}
          {brandName ? (
            <BrandLockup
              name={brandName}
              logoUrl={brandLogo}
              className="mb-1 inline-flex items-center gap-2 text-small font-medium text-muted-foreground"
            />
          ) : null}
          <DialogTitle>{listing.title}</DialogTitle>
          {subtitle && <DialogDescription>{subtitle}</DialogDescription>}
        </DialogHeader>

        <div className="space-y-4">
          {listing.description && (
            <p className="text-medium text-muted-foreground">{listing.description}</p>
          )}

          <dl className="flex flex-wrap gap-x-8 gap-y-2 text-small">
            <div>
              <dt className="text-muted-foreground">{pay.label || 'Pay'}</dt>
              <dd className="font-medium text-foreground">{pay.value}</dd>
            </div>
            {listing.location && (
              <div>
                <dt className="text-muted-foreground">Location</dt>
                <dd className="font-medium text-foreground">
                  {listing.is_remote ? 'Remote' : listing.location}
                </dd>
              </div>
            )}
            {listing.contract_duration_months && (
              <div>
                <dt className="text-muted-foreground">Contract</dt>
                <dd className="font-medium text-foreground">
                  {listing.contract_duration_months} months
                </dd>
              </div>
            )}
          </dl>

          <div className="space-y-2">
            <label htmlFor="connection-message" className="block text-medium font-medium">
              Personalised message
            </label>
            <p className="text-small text-muted-foreground">
              Tell this brand why you are a great fit, in {CONNECTION_MESSAGE_MIN}-
              {CONNECTION_MESSAGE_MAX} characters.
            </p>
            <Textarea
              id="connection-message"
              rows={6}
              maxLength={CONNECTION_MESSAGE_MAX}
              value={message}
              onChange={(e) => {
                setMessage(e.target.value)
                setTouched(true)
              }}
              onBlur={() => setTouched(true)}
              aria-invalid={showError}
              aria-describedby="connection-message-status"
              placeholder="Introduce yourself, your audience and why this campaign suits you"
            />
            <div className="flex items-center justify-between">
              <span
                id="connection-message-status"
                role={touched && tooLong ? 'alert' : undefined}
                className={
                  showError
                    ? 'text-small font-medium text-destructive'
                    : !tooShort && !tooLong
                      ? 'text-small text-success'
                      : 'text-small text-muted-foreground'
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
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" onClick={sendRequest} disabled={!canSend || sending}>
            {sending ? 'Sending' : 'Send request'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
