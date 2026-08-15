'use client'

import { useEffect, useRef } from 'react'
import { motion, useReducedMotion } from 'motion/react'
import { Search } from 'lucide-react'

import { SPRING } from '@/lib/motion/springs'
import { CardSkeleton } from '@/components/ui/card-skeleton'
import { EmptyState } from '@/components/ui/empty-state'
import ListingCard from './listing-card'
import { useListingFilters, ListingsToolbar } from './listings-filter'
import type { ListingSummary } from '@/lib/supabase/discovery'

// PR-19: the grid passes listings straight to ListingCard, which needs the
// brand's *user* id to address a connection request. See ListingSummary.
type GridListing = ListingSummary

interface Props {
  listings: GridListing[]
  /** While true the grid shows skeleton placeholders instead of results (spec §3D.1: skeleton, not spinner). */
  loading?: boolean
  /** Rendered under the grid — the "Load more" affordance for the paginated feed (FA-5). */
  footer?: React.ReactNode
  /** The athlete's own primary sport — boosts on-sport listings in Relevance (DISC6). */
  athleteSport?: string | null
}

// relevanceScore + the filter/sort/toolbar machinery now live in
// ./listings-filter so the swipe mode can share exactly the same controls and
// filtered result set (DISC5). This component renders the grid off that hook.
export default function ListingsGrid({ listings, loading = false, footer, athleteSport }: Props) {
  const filters = useListingFilters(listings, { athleteSport: athleteSport ?? null })
  const filtered = filters.filtered

  // Entry-motion guard (UX audit M4): stagger the cards in on the grid's FIRST
  // mount only. `animateFirstMount` is read during render — true on the initial
  // pass, then flipped off after commit — so filter/sort/load-more re-renders
  // (which unmount and remount cards) render statically instead of replaying.
  const reduced = useReducedMotion()
  const firstMountRef = useRef(true)
  const animateFirstMount = firstMountRef.current
  useEffect(() => {
    firstMountRef.current = false
  }, [])
  const cardMotion = (index: number) =>
    animateFirstMount
      ? {
          initial: reduced ? { opacity: 0 } : { opacity: 0, y: 8 },
          animate: { opacity: 1, y: 0 },
          transition: { ...SPRING.default, delay: reduced ? 0 : Math.min(index, 8) * 0.04 },
        }
      : { initial: false as const }

  return (
    <div className="space-y-6">
      <ListingsToolbar state={filters} listings={listings} />

      <p data-testid="results-count" aria-live="polite" className="text-small text-muted-foreground">
        {filtered.length} {filtered.length === 1 ? 'result' : 'results'}
      </p>

      {loading ? (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <CardSkeleton key={i} />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<Search />}
          title="No campaigns found"
          description="Try clearing a filter or broadening your search to see more opportunities."
          // DISC9: the empty state now offers a way out, not just advice.
          {...(filters.hasActiveFilters
            ? { action: { label: 'Clear all filters', onClick: filters.reset } }
            : {})}
        />
      ) : (
        <div
          data-testid="listings-grid"
          className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3"
        >
          {filtered.map((l, index) => (
            <motion.div key={l.id} {...cardMotion(index)}>
              <ListingCard listing={l} />
            </motion.div>
          ))}
        </div>
      )}

      {footer}
    </div>
  )
}
