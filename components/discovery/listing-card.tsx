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

// DISC7: job_listings carries no campaign image column (see types/database.ts),
// so there is no brand-supplied artwork to use and the old random Unsplash-style
// stock (a pug, a leaf) actively misled. A neutral on-brand placeholder replaces
// it; brand identity is carried by the overlay lockup + card body instead.
const CAMPAIGN_PLACEHOLDER = '/placeholder-cover.svg'

function formatLevel(level: string | null): string | null {
  return level ? level.replace(/_/g, ' ') : null
}

/** Two-letter monogram used as a brand logo stand-in (DISC1/DISC7). */
function brandInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase()
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase()
}

/** Deterministic hue (0–359) so a brand always reads the same colour everywhere. */
function brandHue(name: string): number {
  let hue = 0
  for (let i = 0; i < name.length; i++) hue = (hue * 31 + name.charCodeAt(i)) % 360
  return hue
}

/** Deterministic brand colour so a brand always reads the same across cards. */
function brandColor(name: string): string {
  return `hsl(${brandHue(name)} 52% 42%)`
}

/**
 * A branded cover tile (DISC1/DISC7). Real brand artwork (`cover_image_url`) is
 * preferred; when a brand has uploaded none, this inline SVG gives the card an
 * intentional, on-brand cover — a deterministic gradient in the brand's colour
 * with its monogram — instead of a single flat grey placeholder shared by every
 * card. Encoded as a data URI so it needs no network round-trip or stored asset.
 */
function brandCoverDataUri(name: string): string {
  const hue = brandHue(name)
  const svg =
    `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 400 240'>` +
    `<defs><linearGradient id='g' x1='0' y1='0' x2='1' y2='1'>` +
    `<stop offset='0' stop-color='hsl(${hue} 55% 46%)'/>` +
    `<stop offset='1' stop-color='hsl(${hue} 52% 30%)'/>` +
    `</linearGradient></defs>` +
    `<rect width='400' height='240' fill='url(#g)'/>` +
    `<text x='200' y='150' text-anchor='middle' font-family='system-ui,sans-serif' ` +
    `font-size='104' font-weight='700' fill='rgba(255,255,255,0.9)'>${brandInitials(name)}</text>` +
    `</svg>`
  return `data:image/svg+xml,${encodeURIComponent(svg)}`
}

/**
 * DISC4: the pay slot is always populated. A listing with no `pay_amount` used
 * to drop the row entirely, so cards were uneven. Every card now states its pay
 * shape — a figure, "Revenue share", or "Fee undisclosed".
 */
function payDisplay(listing: ListingSummary): { value: string; label: string } {
  if (listing.pay_type === 'revenue_share') return { value: 'Revenue share', label: '' }
  if (listing.pay_amount != null) {
    return {
      value: `${listing.pay_currency} ${listing.pay_amount.toLocaleString()}`,
      label: listing.pay_type ? (PAY_TYPE_LABEL[listing.pay_type] ?? '') : '',
    }
  }
  return { value: 'Fee undisclosed', label: '' }
}

/**
 * Brand name preceded by the real brand logo when one exists, else a coloured
 * monogram stand-in. The mark is decorative (the name carries the label).
 */
function BrandLockup({
  name,
  logoUrl,
  className,
}: {
  name: string
  logoUrl?: string | null
  className?: string
}) {
  return (
    <span className={className}>
      {logoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- brand logos come from arbitrary hosts not declared in next.config images.remotePatterns
        <img
          src={logoUrl}
          alt=""
          aria-hidden="true"
          className="size-5 shrink-0 rounded-full object-cover ring-1 ring-foreground/10"
        />
      ) : (
        <span
          aria-hidden="true"
          style={{ backgroundColor: brandColor(name) }}
          className="inline-flex size-5 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold text-white"
        >
          {brandInitials(name)}
        </span>
      )}
      <span className="min-w-0 truncate">{name}</span>
    </span>
  )
}

export default function ListingCard({ listing }: Props) {
  const [open, setOpen] = useState(false)
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

  // DISC1/DISC7: prefer the brand's real cover art; otherwise a branded tile in
  // the brand's colour, never the single flat grey placeholder for every card.
  const coverImage = listing.brand_cover_url
    ? listing.brand_cover_url
    : brandName
      ? brandCoverDataUri(brandName)
      : CAMPAIGN_PLACEHOLDER

  const brandBadge = brandName ? (
    <BrandLockup
      name={brandName}
      logoUrl={brandLogo}
      className="inline-flex max-w-[12rem] items-center gap-1.5 rounded-full bg-card/90 py-1 pl-1 pr-2.5 text-small font-medium text-foreground shadow-sm ring-1 ring-foreground/10 backdrop-blur"
    />
  ) : null

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
      setTouched(false)
    } catch {
      toast.error('Could not send your request. Please check your connection and try again.')
    } finally {
      setSending(false)
    }
  }

  return (
    <>
      <MarketplaceCard
        image={coverImage}
        imageAlt={brandName ? `${brandName} campaign` : `${listing.title} campaign`}
        imageRatio={0.6}
        title={listing.title}
        // DISC1: name the brand on the card. The lockup sits over the artwork;
        // the sport/level line stays as the subtitle.
        {...(brandBadge ? { overlayBadges: brandBadge } : {})}
        // Spread optional props only when present — required by exactOptionalPropertyTypes.
        {...(subtitle ? { subtitle } : {})}
        stat={pay}
        tags={tags}
        // DISC2: the CTA opens the request composer, so it is labelled for that
        // outcome rather than the ambiguous "View".
        cta={{ label: 'Request', onClick: () => setOpen(true) }}
      />

      <Dialog open={open} onOpenChange={setOpen}>
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
                Tell this brand why you are a great fit, in {CONNECTION_MESSAGE_MIN}–
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
                placeholder="Introduce yourself, your audience and why this campaign suits you…"
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
