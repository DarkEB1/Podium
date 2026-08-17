'use client'

import { useState } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { Bookmark, BookmarkCheck, RotateCcw } from 'lucide-react'

import { SwipeDeck } from '@/components/ui/swipe-card'
import { MatchScore } from '@/components/discovery/match-score'
import { brandCoverDataUri, payDisplay } from '@/components/discovery/brand-visual'
import { Button, buttonVariants } from '@/components/ui/button'
import { ROUTES } from '@/lib/routes'
import { cn } from '@/lib/utils'
import type { ScoredListing } from '@/lib/discovery/match'
import type { SwipeDirection } from '@/components/ui/swipe-card'

interface Props {
  listings: ScoredListing[]
}

/**
 * DiscoverDeck — the athlete swipe surface (Task 10). Wraps the shared
 * SwipeDeck with a reviewed/total progress bar, a real shortlist save on a
 * right swipe (the same persisted action the grid uses), and an end-of-deck
 * payoff that either routes the athlete to their saved list or invites them
 * to review the deck again.
 *
 * The deck's queue is derived state (listings minus swiped ids) rather than
 * a mutated copy, so "Review again" is just clearing that id list.
 */
export function DiscoverDeck({ listings }: Props) {
  const [swiped, setSwiped] = useState<string[]>([])
  const [saved, setSaved] = useState(0)
  const [pulseId, setPulseId] = useState<number | null>(null)
  const reducedMotion = useReducedMotion()

  const total = listings.length
  const reviewed = Math.min(swiped.length, total)
  const queue = listings.filter((l) => !swiped.includes(l.id))

  async function save(listing: ScoredListing) {
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

  function handleSwipe(id: string, direction: SwipeDirection) {
    const listing = listings.find((l) => l.id === id)
    setSwiped((prev) => (prev.includes(id) ? prev : [...prev, id]))
    if (direction === 'right' && listing) {
      setSaved((n) => n + 1)
      if (!reducedMotion) setPulseId(Date.now())
      void save(listing)
    }
  }

  function reset() {
    setSwiped([])
    setSaved(0)
  }

  return (
    <div className="space-y-4">
      <div className="mx-auto w-full max-w-sm space-y-1.5">
        <div
          role="progressbar"
          aria-label="Deck progress"
          aria-valuenow={reviewed}
          aria-valuemin={0}
          aria-valuemax={total}
          aria-valuetext={`${reviewed} of ${total} reviewed`}
          className="h-2 w-full overflow-hidden rounded-full bg-muted"
        >
          <div
            className="h-full rounded-full bg-lime transition-[width]"
            style={{ width: total > 0 ? `${(reviewed / total) * 100}%` : '0%' }}
          />
        </div>
        <p aria-hidden="true" className="text-center text-small text-muted-foreground">
          {reviewed} / {total} reviewed
        </p>
      </div>

      <div className="relative">
        <AnimatePresence>
          {pulseId !== null ? (
            <motion.span
              key={pulseId}
              aria-hidden="true"
              initial={{ opacity: 0.6, scale: 0.5 }}
              animate={{ opacity: 0, scale: 1.6 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.45, ease: 'easeOut' }}
              onAnimationComplete={() => setPulseId(null)}
              className="pointer-events-none absolute inset-0 z-20 m-auto size-28 rounded-full bg-lime"
            />
          ) : null}
        </AnimatePresence>

        <SwipeDeck
          cards={queue.map((listing) => ({
            id: listing.id,
            image:
              listing.brand_cover_url ??
              (listing.brand_name ? brandCoverDataUri(listing.brand_name) : '/placeholder-cover.svg'),
            imageAlt: listing.brand_name
              ? `${listing.brand_name} campaign`
              : `${listing.title} campaign`,
            title: listing.title,
            ...(listing.brand_name ? { subtitle: listing.brand_name } : {}),
            ...(listing.matchReasons[0] ? { seeking: listing.matchReasons[0] } : {}),
            availability: payDisplay(listing).value,
            likeLabel: 'Save',
            passLabel: 'Skip',
            // Bookmark, not a check, so the action reads as a save, not an apply.
            likeIcon: Bookmark,
            showActionLabels: true,
            glossy: true,
            overlay: <MatchScore size="sm" score={listing.matchScore} />,
          }))}
          onSwipe={handleSwipe}
          empty={
            saved > 0 ? (
              <div className="mx-auto flex w-full max-w-sm flex-col items-center gap-4 rounded-2xl border border-border bg-card p-8 text-center shadow-card">
                <span
                  aria-hidden="true"
                  className="flex size-16 items-center justify-center rounded-full bg-lime-tint-2"
                >
                  <BookmarkCheck className="size-7 text-foreground" />
                </span>
                <div className="space-y-1">
                  <h2 className="font-heading text-large font-semibold">
                    You saved {saved}. Send requests?
                  </h2>
                  <p className="text-small text-muted-foreground">
                    Your shortlist is ready when you are.
                  </p>
                </div>
                <div className="flex w-full flex-col gap-2">
                  <Link href={ROUTES.athlete.saved} className={cn(buttonVariants(), 'w-full')}>
                    Send requests
                  </Link>
                  <Button type="button" variant="outline" className="w-full" onClick={reset}>
                    Review again
                  </Button>
                </div>
              </div>
            ) : (
              <div className="mx-auto flex w-full max-w-sm flex-col items-center gap-4 rounded-2xl border border-border bg-card p-8 text-center shadow-card">
                <span
                  aria-hidden="true"
                  className="flex size-16 items-center justify-center rounded-full bg-muted"
                >
                  <RotateCcw className="size-7 text-muted-foreground" />
                </span>
                <div className="space-y-1">
                  <h2 className="font-heading text-large font-semibold">No saves this round</h2>
                  <p className="text-small text-muted-foreground">
                    Review the deck again to find a match.
                  </p>
                </div>
                <Button type="button" className="w-full" onClick={reset}>
                  Start over
                </Button>
              </div>
            )
          }
        />
      </div>
    </div>
  )
}
