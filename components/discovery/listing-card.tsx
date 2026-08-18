'use client'

import { useState } from 'react'

import { MarketplaceCard } from '@/components/ui/marketplace-card'
import type { ListingSummary } from '@/lib/supabase/discovery'

import { BrandLockup, brandCoverDataUri, payDisplay, formatLevel } from './brand-visual'
import { ConnectionRequestDialog } from './connection-request'

interface Props {
  /** `JobListingWithBrand` is a superset of `ListingSummary`, so both fit. */
  listing: ListingSummary
}

// DISC7: job_listings carries no campaign image column (see types/database.ts),
// so there is no brand-supplied artwork to use and the old random Unsplash-style
// stock (a pug, a leaf) actively misled. A neutral on-brand placeholder replaces
// it; brand identity is carried by the overlay lockup + card body instead.
const CAMPAIGN_PLACEHOLDER = '/placeholder-cover.svg'

export default function ListingCard({ listing }: Props) {
  const [open, setOpen] = useState(false)

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
        // Spread optional props only when present (exactOptionalPropertyTypes).
        {...(subtitle ? { subtitle } : {})}
        stat={pay}
        tags={tags}
        // DISC2: the CTA opens the request composer, so it is labelled for that
        // outcome rather than the ambiguous "View".
        cta={{ label: 'Request', onClick: () => setOpen(true) }}
      />

      <ConnectionRequestDialog listing={listing} open={open} onOpenChange={setOpen} />
    </>
  )
}
