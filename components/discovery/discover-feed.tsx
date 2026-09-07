'use client'

import { ArrowRight, Search } from 'lucide-react'

import { BrowseModeToggle, type BrowseMode } from '@/components/ui/browse-mode-toggle'
import { EmptyState } from '@/components/ui/empty-state'
import type { ScoredListing } from '@/lib/discovery/match'
import type { Rail } from '@/lib/discovery/rails'

import { useBrowseMode } from './use-browse-mode'
import { useListingFilters, ListingsToolbar } from './listings-filter'
import { OpportunityCard } from './opportunity-card'
import { OpportunityRail } from './opportunity-rail'
import { DiscoverDeck } from './discover-deck'

interface Props {
  listings: ScoredListing[]
  rails: Rail[]
  /** Persisted `profiles.discovery_ui_mode` for this user. */
  initialMode: BrowseMode
  /** The athlete's own primary sport. Boosts on-sport listings in Relevance (DISC6). */
  athleteSport: string | null
  /** Footer for the feed: the "Load more" control (FA-5). */
  footer?: React.ReactNode
}

/** The offset/rotated cards behind the deck callout. Purely decorative. */
const STACK: { rot: number; x: number; y: number; opacity: number; score: string }[] = [
  { rot: 7, x: 46, y: 20, opacity: 0.42, score: '79' },
  { rot: -4.5, x: -42, y: 10, opacity: 0.7, score: '84' },
  { rot: 1.5, x: 0, y: -6, opacity: 1, score: '88' },
]

/**
 * DeckCallout: the deck-entry teaser (Task 11). A dark board panel with a
 * physical stack of offset/rotated cards, sat above the rails so the swipe deck
 * stays discoverable as the star of the surface.
 *
 * When `onStart` is passed (marketplace mode) it carries a "Start reviewing"
 * button that switches to swipe mode. In swipe mode the button is dropped: the
 * athlete is already reviewing, so the callout is a heading, not an action.
 */
function DeckCallout({ count, onStart }: { count: number; onStart?: () => void }) {
  return (
    <section
      data-testid="deck-callout"
      className="relative grid gap-8 overflow-hidden rounded-2xl border border-border bg-foreground p-8 text-background md:grid-cols-[1.4fr_320px] md:items-center"
    >
      <div>
        <div className="mb-3.5 inline-flex items-center gap-2 font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-background/70">
          <span
            aria-hidden="true"
            className="size-2 rounded-full bg-lime motion-safe:animate-pulse"
          />
          Swipe deck
        </div>
        <h2 className="mb-2.5 text-large font-bold leading-tight tracking-tight md:text-[31px]">
          Review your {count} {count === 1 ? 'match' : 'matches'}
        </h2>
        <p className="mb-6 max-w-[40ch] text-medium text-background/70">
          One at a time. Save the ones you like, then send requests at the end.
        </p>
        {onStart ? (
          <div className="flex flex-wrap items-center gap-4">
            <button
              type="button"
              onClick={onStart}
              className="group inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-3 text-medium font-bold text-primary-foreground shadow-card transition hover:-translate-y-0.5 hover:shadow-card-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-foreground"
            >
              Start reviewing
              <ArrowRight
                aria-hidden="true"
                className="size-4 transition-transform group-hover:translate-x-0.5"
              />
            </button>
            <span className="font-mono text-small text-background/50">skip left, save right</span>
          </div>
        ) : (
          <span className="font-mono text-small text-background/50">skip left, save right</span>
        )}
      </div>

      {/* Decorative stacked-card teaser (prototype "direction C"). */}
      <div aria-hidden="true" className="relative hidden h-48 md:block">
        {STACK.map((card, i) => (
          <div
            key={i}
            style={{
              transform: `rotate(${card.rot}deg) translate(${card.x}px, ${card.y}px)`,
              opacity: card.opacity,
              marginLeft: -105,
            }}
            className="absolute left-1/2 top-5 h-[150px] w-[210px] rounded-2xl border border-border bg-card p-4 text-foreground shadow-card-hover"
          >
            <span className="inline-flex flex-col items-start rounded-lg bg-foreground px-2.5 py-1.5">
              <span className="font-mono text-large font-bold text-background">{card.score}</span>
              <span className="mt-1 h-0.5 w-full rounded-full bg-lime" />
            </span>
            <span className="mt-3 block h-2.5 w-3/4 rounded-full bg-muted" />
            <span className="mt-2 block h-2 w-1/2 rounded-full bg-muted" />
            <span className="mt-4 block h-2 w-2/3 rounded-full bg-border" />
          </div>
        ))}
      </div>
    </section>
  )
}

/**
 * DiscoverFeed: the Live Board client orchestrator (Task 11).
 *
 * Renders the browse-mode toggle (persisted via `useBrowseMode`) and switches
 * between two surfaces:
 *
 * - swipe: the deck-entry callout above the `DiscoverDeck`.
 * - marketplace: the shared `ListingsToolbar` plus the deck callout, then the
 *   made-for-you rails when no search/filter is active, or a flat responsive
 *   grid of the filtered listings once the athlete narrows the set, so search
 *   stays useful and the rails do not fight the query.
 *
 * Server component fetches the data; this component is client only for the
 * toggle, the filter state and the deck interactivity (no Supabase here).
 */
export function DiscoverFeed({ listings, rails, initialMode, athleteSport, footer }: Props) {
  const { mode, setMode, pending } = useBrowseMode(initialMode)
  const filters = useListingFilters(listings, { athleteSport })
  // useListingFilters is typed over ListingSummary, but it only filters and
  // re-sorts the array it was handed, so every survivor is still the
  // ScoredListing that went in, so it is safe to read the card's match fields.
  const filtered = filters.filtered as ScoredListing[]

  return (
    <div className="space-y-6" data-testid="discover-feed">
      <div className="flex justify-end">
        <BrowseModeToggle value={mode} onChange={setMode} pending={pending} />
      </div>

      {mode === 'swipe' ? (
        <div className="space-y-8">
          <DeckCallout count={listings.length} />
          <DiscoverDeck listings={listings} />
        </div>
      ) : (
        <div className="space-y-8">
          <ListingsToolbar state={filters} listings={listings} />
          <DeckCallout count={listings.length} onStart={() => setMode('swipe')} />

          {filters.hasActiveFilters ? (
            <div data-testid="discover-grid" className="space-y-6">
              {/* WS-LISTING-06: a search that survives to zero listings showed a
                  bare empty grid with no way back. Mirror the ListingsGrid empty
                  state and offer "Clear all filters". */}
              {filtered.length === 0 ? (
                <EmptyState
                  icon={<Search />}
                  title="No campaigns found"
                  description="Try clearing a filter or broadening your search to see more opportunities."
                  action={{ label: 'Clear all filters', onClick: filters.reset }}
                />
              ) : (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {filtered.map((listing) => (
                    <OpportunityCard key={listing.id} listing={listing} />
                  ))}
                </div>
              )}
              {footer}
            </div>
          ) : listings.length === 0 ? (
            // WS-LISTING-06: with no listings at all the rails collapse to
            // nothing; show a real empty state instead of a blank board.
            <div data-testid="discover-empty">
              <EmptyState
                icon={<Search />}
                title="No opportunities yet"
                description="There are no live campaigns right now. Check back soon — new sponsorship offers are added regularly."
              />
            </div>
          ) : (
            <div data-testid="discover-rails" className="space-y-6">
              <div>
                {rails.map((rail, i) => (
                  <OpportunityRail key={rail.id} rail={rail} index={i} />
                ))}
              </div>
              {footer}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default DiscoverFeed
