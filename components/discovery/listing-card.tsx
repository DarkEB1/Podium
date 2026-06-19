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
import type { Database } from '@/types/database'

type JobListingRow = Database['public']['Tables']['job_listings']['Row']

interface Props {
  listing: JobListingRow
}

/** A personalised connection request must be at least this long (spec §3D.1). */
const MIN_MESSAGE_LENGTH = 300

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

  const tooShort = message.trim().length < MIN_MESSAGE_LENGTH

  async function sendRequest() {
    setSending(true)
    try {
      const res = await fetch('/api/discovery/connections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recipient_id: listing.brand_id, message: message.trim() }),
      })
      const data = (await res.json()) as { error?: { message?: string } }
      if (!res.ok) {
        toast.error(data.error?.message ?? 'Could not send your request')
        return
      }
      toast.success('Connection request sent')
      setOpen(false)
      setMessage('')
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
                Tell this brand why you are a great fit. Send a personalised message of at least{' '}
                {MIN_MESSAGE_LENGTH} characters.
              </p>
              <Textarea
                id="connection-message"
                rows={6}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                aria-invalid={tooShort}
                placeholder="Introduce yourself, your audience and why this campaign suits you…"
              />
              <div className="flex items-center justify-between">
                <span
                  className={
                    tooShort ? 'text-small font-medium text-destructive' : 'text-small text-success'
                  }
                >
                  {tooShort
                    ? `Write at least ${MIN_MESSAGE_LENGTH} characters`
                    : 'Ready to send'}
                </span>
                <CharacterCounter value={message} max={MIN_MESSAGE_LENGTH} />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="button" onClick={sendRequest} disabled={tooShort || sending}>
              {sending ? 'Sending…' : 'Send request'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
