'use client'

import { useState } from 'react'
import { toast } from 'sonner'

import { BrowseModeToggle, type BrowseMode } from '@/components/ui/browse-mode-toggle'
import { SwipeDeck } from '@/components/ui/swipe-card'
import { EmptyState } from '@/components/ui/empty-state'
import { ROUTES } from '@/lib/routes'
import type { ListingSummary } from '@/lib/supabase/discovery'

import ListingsGrid from './listings-grid'
import { useBrowseMode } from './use-browse-mode'

interface Props {
  listings: ListingSummary[]
  /** Persisted `profiles.discovery_ui_mode` for this user. */
  initialMode: BrowseMode
  /** Footer for the grid — the "Load more" control (FA-5). */
  footer?: React.ReactNode
}

function placeholderImage(seed: string): string {
  // Same deterministic placeholder the grid card uses, so both modes agree.
  return `https://picsum.photos/seed/${encodeURIComponent(seed)}/600/360`
}

/**
 * ListingsBrowser — PR-23: the surface that actually renders BrowseModeToggle.
 *
 * Both browse modes ship at launch. The toggle switches between the marketplace
 * grid and the swipe deck and persists the choice to `discovery_ui_mode`.
 *
 * Swiping "Interested" is not a fake gesture: it POSTs to
 * `/api/discovery/shortlist` — the same persisted save the rest of the product
 * uses — targeting the listing's brand **user** id (PR-19). Sending a
 * connection request cannot happen from a swipe because it requires a
 * personalised message of at least CONNECTION_MESSAGE_MIN characters, so the
 * swipe saves the campaign and the grid card composes the request.
 */
export default function ListingsBrowser({ listings, initialMode, footer }: Props) {
  const { mode, setMode, pending } = useBrowseMode(initialMode)
  const [swiped, setSwiped] = useState<string[]>([])

  const queue = listings.filter((l) => !swiped.includes(l.id))

  async function save(listing: ListingSummary) {
    if (!listing.brand_user_id) {
      toast.error('This campaign has no contactable brand yet.')
      return
    }
    try {
      const res = await fetch(ROUTES.api.discovery.shortlist, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target_user_id: listing.brand_user_id }),
      })
      // 409 ALREADY_SHORTLISTED is a benign no-op.
      if (!res.ok && res.status !== 409) throw new Error('request failed')
      toast.success('Saved to your shortlist')
    } catch {
      toast.error('Could not save that campaign. Please try again.')
    }
  }

  function handleSwipe(id: string, direction: 'left' | 'right') {
    const listing = listings.find((l) => l.id === id)
    setSwiped((prev) => (prev.includes(id) ? prev : [...prev, id]))
    if (direction === 'right' && listing) void save(listing)
  }

  return (
    <div className="space-y-6" data-testid="listings-browser">
      <div className="flex justify-end">
        <BrowseModeToggle value={mode} onChange={setMode} pending={pending} />
      </div>

      {mode === 'swipe' ? (
        <SwipeDeck
          cards={queue.map((l) => ({
            id: l.id,
            image: placeholderImage(l.id),
            imageAlt: `${l.title} campaign artwork`,
            title: l.title,
            ...(l.brand_name ? { subtitle: l.brand_name } : {}),
            ...(l.sport_required ? { seeking: l.sport_required } : {}),
            ...(l.pay_amount
              ? { availability: `${l.pay_currency} ${l.pay_amount.toLocaleString()}` }
              : {}),
            likeLabel: 'Save',
            passLabel: 'Skip',
          }))}
          onSwipe={handleSwipe}
          empty={
            <EmptyState
              title="That is every campaign for now"
              description="Switch to grid view to review them again, or check back soon for new campaigns."
            />
          }
        />
      ) : (
        <ListingsGrid listings={listings} {...(footer ? { footer } : {})} />
      )}
    </div>
  )
}
