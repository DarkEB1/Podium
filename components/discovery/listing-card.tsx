'use client'

import { useState } from 'react'
import { toast } from 'sonner'

import { MarketplaceCard } from '@/components/ui/marketplace-card'
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

interface Props {
  /** `JobListingWithBrand` is a superset of `ListingSummary`, so both fit. */
  listing: ListingSummary
}

const PAY_TYPE_LABEL: Record<string, string> = {
  flat_fee: 'Flat fee',
  monthly_retainer: 'Monthly retainer',
  per_post: 'Per post',
  revenue_share: 'Revenue share',
}

function placeholderImage(seed: string): string {
  // Deterministic placeholder so cards have a stable visual until brands upload campaign art.
  return `https://picsum.photos/seed/${encodeURIComponent(seed)}/600/360`
}

function formatLevel(level: string | null): string | null {
  return level ? level.replace(/_/g, ' ') : null
}

export default function ListingCard({ listing }: Props) {
  const [open, setOpen] = useState(false)
  const [message, setMessage] = useState('')
  const [sending, setSending] = useState(false)

  const payLabel = listing.pay_type ? PAY_TYPE_LABEL[listing.pay_type] : null
  const subtitle = [listing.sport_required, formatLevel(listing.level_required)]
    .filter(Boolean)
    .join(' · ')

  const stat =
    payLabel && listing.pay_amount
      ? {
          label: payLabel,
          value: `${listing.pay_currency} ${listing.pay_amount.toLocaleString()}`,
        }
      : undefined

  const tags = (
    <>
      {listing.location && (
        <span className="rounded-full bg-muted px-2 py-0.5 text-small">
          {listing.is_remote ? 'Remote' : listing.location}
        </span>
      )}
      {listing.contract_duration_months && (
        <span className="rounded-full bg-muted px-2 py-0.5 text-small">
          {listing.contract_duration_months}mo contract
        </span>
      )}
    </>
  )

  const trimmedLength = message.trim().length
  const tooShort = trimmedLength < CONNECTION_MESSAGE_MIN
  const tooLong = trimmedLength > CONNECTION_MESSAGE_MAX
  // PR-19: a listing whose brand profile could not be resolved has nobody to
  // send to. Disable rather than let the request fail its FK server-side.
  const canSend = !tooShort && !tooLong && listing.brand_user_id !== null

  async function sendRequest() {
    if (!listing.brand_user_id) return
    setSending(true)
    try {
      // PR-19: must be the brand's *user* id. `listing.brand_id` is a
      // brand_profiles.id and violates the recipient FK — see JobListingWithBrand.
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
      // M-6 `connection_request_sent` — fired only after a 2xx. The recipient
      // is always a brand on this surface; the message body and the recipient
      // id are deliberately NOT sent.
      track('connection_request_sent', { recipient_role: 'brand', surface: 'listing_card' })
      toast.success('Connection request sent')
      setOpen(false)
      setMessage('')
    } catch {
      toast.error('Could not send your request. Please check your connection and try again.')
    } finally {
      setSending(false)
    }
  }

  return (
    <>
      <MarketplaceCard
        image={placeholderImage(listing.id)}
        imageAlt={`${listing.title} campaign artwork`}
        imageRatio={0.6}
        title={listing.title}
        // Spread optional props only when present — required by exactOptionalPropertyTypes.
        {...(subtitle ? { subtitle } : {})}
        {...(stat ? { stat } : {})}
        tags={tags}
        cta={{ label: 'View', onClick: () => setOpen(true) }}
      />

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{listing.title}</DialogTitle>
            {subtitle && <DialogDescription>{subtitle}</DialogDescription>}
          </DialogHeader>

          <div className="space-y-4">
            {listing.description && (
              <p className="text-medium text-muted-foreground">{listing.description}</p>
            )}

            <dl className="flex flex-wrap gap-x-8 gap-y-2 text-small">
              {stat && (
                <div>
                  <dt className="text-muted-foreground">{stat.label}</dt>
                  <dd className="font-medium text-foreground">{stat.value}</dd>
                </div>
              )}
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
                Tell this brand why you are a great fit — between {CONNECTION_MESSAGE_MIN} and{' '}
                {CONNECTION_MESSAGE_MAX} characters.
              </p>
              <Textarea
                id="connection-message"
                rows={6}
                maxLength={CONNECTION_MESSAGE_MAX}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                aria-invalid={tooShort || tooLong}
                aria-describedby="connection-message-status"
                placeholder="Introduce yourself, your audience and why this campaign suits you…"
              />
              <div className="flex items-center justify-between">
                <span
                  id="connection-message-status"
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
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="button" onClick={sendRequest} disabled={!canSend || sending}>
              {sending ? 'Sending…' : 'Send request'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
