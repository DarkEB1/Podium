'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Bookmark, Search } from 'lucide-react'

import { BrowseModeToggle, type BrowseMode } from '@/components/ui/browse-mode-toggle'
import { SwipeDeck } from '@/components/ui/swipe-card'
import { EmptyState } from '@/components/ui/empty-state'
import { ROUTES } from '@/lib/routes'
import type { ListingSummary } from '@/lib/supabase/discovery'

import ListingsGrid from './listings-grid'
import { useBrowseMode } from './use-browse-mode'
import { useListingFilters, ListingsToolbar } from './listings-filter'

interface Props {
  listings: ListingSummary[]
  /** Persisted `profiles.discovery_ui_mode` for this user. */
  initialMode: BrowseMode
  /** Footer for the grid — the "Load more" control (FA-5). */
  footer?: React.ReactNode
  /** The athlete's own primary sport — boosts on-sport listings in Relevance (DISC6). */
  athleteSport?: string | null
}

/**
 * ListingsBrowser — PR-23: the surface that actually renders BrowseModeToggle.
 *
 * Both browse modes ship at launch. The toggle switches between the marketplace
 * grid and the swipe deck and persists the choice to `discovery_ui_mode`.
 *
 * DISC5: search / sort / filter controls are visible in BOTH modes. The grid
 * mode carries them inside ListingsGrid; the swipe mode renders the same
 * ListingsToolbar here and feeds its filtered result set straight into the deck.
 *
 * Swiping "Save" is not a fake gesture: it POSTs to `/api/discovery/shortlist`
 * — the same persisted save the rest of the product uses — targeting the
 * listing's brand **user** id (PR-19). Sending a connection request cannot
 * happen from a swipe because it requires a personalised message of at least
 * CONNECTION_MESSAGE_MIN characters, so the swipe saves the campaign and the
 * grid card composes the request.
 */
export default function ListingsBrowser({ listings, initialMode, footer, athleteSport }: Props) {
  const { mode, setMode, pending } = useBrowseMode(initialMode)
  const [swiped, setSwiped] = useState<string[]>([])

  // Swipe mode's copy of the shared controls (DISC5). Grid mode owns its own
  // instance inside ListingsGrid; only one mode is mounted at a time.
  const filters = useListingFilters(listings, { athleteSport: athleteSport ?? null })
  const filtered = filters.filtered
  const queue = filtered.filter((l) => !swiped.includes(l.id))

  // DISC8: deck progress. Position of the current card within the filtered set.
  const total = filtered.length
  const position = Math.min(total - queue.length + 1, total)

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
        <div className="space-y-4">
          <ListingsToolbar state={filters} listings={listings} />

          <p
            data-testid="results-count"
            aria-live="polite"
            className="text-small text-muted-foreground"
          >
            {filtered.length} {filtered.length === 1 ? 'result' : 'results'}
          </p>

          {filtered.length === 0 ? (
            <EmptyState
              icon={<Search />}
              title="No campaigns found"
              description="Try clearing a filter or broadening your search to see more opportunities."
              {...(filters.hasActiveFilters
                ? { action: { label: 'Clear all filters', onClick: filters.reset } }
                : {})}
            />
          ) : (
            <div className="space-y-3">
              {queue.length > 0 ? (
                <p
                  data-testid="deck-progress"
                  aria-live="polite"
                  className="text-center text-small font-medium text-muted-foreground"
                >
                  {position} of {total}
                </p>
              ) : null}
              {/* First-use hint (DISC8). */}
              <p className="text-center text-small text-muted-foreground">
                Swipe or use the buttons — Skip to pass, Save to add to your shortlist.
              </p>
              <SwipeDeck
                cards={queue.map((l) => ({
                  id: l.id,
                  // DISC7: no campaign image column exists, so use a neutral
                  // on-brand placeholder rather than random stock.
                  image: '/placeholder-cover.svg',
                  imageAlt: l.brand_name ? `${l.brand_name} campaign` : `${l.title} campaign`,
                  title: l.title,
                  ...(l.brand_name ? { subtitle: l.brand_name } : {}),
                  ...(l.sport_required ? { seeking: l.sport_required } : {}),
                  ...(l.pay_amount
                    ? { availability: `${l.pay_currency} ${l.pay_amount.toLocaleString()}` }
                    : {}),
                  likeLabel: 'Save',
                  passLabel: 'Skip',
                  // DISC8: bookmark (a save affordance), not a check (reads as apply).
                  likeIcon: Bookmark,
                  showActionLabels: true,
                }))}
                onSwipe={handleSwipe}
                empty={
                  <EmptyState
                    title="That is every campaign for now"
                    description="Switch to grid view to review them again, or check back soon for new campaigns."
                  />
                }
              />
            </div>
          )}
        </div>
      ) : (
        <ListingsGrid
          listings={listings}
          {...(athleteSport != null ? { athleteSport } : {})}
          {...(footer ? { footer } : {})}
        />
      )}
    </div>
  )
}
