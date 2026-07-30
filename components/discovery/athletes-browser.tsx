'use client'

import { useState } from 'react'
import { toast } from 'sonner'

import { BrowseModeToggle, type BrowseMode } from '@/components/ui/browse-mode-toggle'
import { SwipeDeck } from '@/components/ui/swipe-card'
import { EmptyState } from '@/components/ui/empty-state'
import AthletesGrid from '@/components/brand/athletes-grid'
import { ROUTES } from '@/lib/routes'
import type { AthleteSummary } from '@/lib/supabase/profiles'

import { useBrowseMode } from './use-browse-mode'

interface Props {
  athletes: AthleteSummary[]
  /** Persisted `profiles.discovery_ui_mode` for this brand. */
  initialMode: BrowseMode
  savedUserIds?: string[]
  /** user_ids holding an approved verification request (QA-3.1). */
  verifiedUserIds?: string[]
  tier?: number
  /** Footer for the grid — the "Load more" control (FA-5). */
  footer?: React.ReactNode
}

/**
 * AthletesBrowser — PR-23 on the brand side.
 *
 * Swiping "Interested" runs the *same* mutation as the grid's bookmark:
 * `POST /api/discovery/shortlist` (see components/brand/athlete-card.tsx). One
 * shortlist, whichever mode you browse in.
 */
export default function AthletesBrowser({
  athletes,
  initialMode,
  savedUserIds = [],
  verifiedUserIds = [],
  tier,
  footer,
}: Props) {
  const { mode, setMode, pending } = useBrowseMode(initialMode)
  const [swiped, setSwiped] = useState<string[]>([])
  const [saved, setSaved] = useState<string[]>(savedUserIds)

  const queue = athletes.filter((a) => !swiped.includes(a.id))

  async function shortlist(athlete: AthleteSummary) {
    try {
      const res = await fetch(ROUTES.api.discovery.shortlist, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target_user_id: athlete.user_id }),
      })
      // 409 ALREADY_SHORTLISTED is a benign no-op.
      if (!res.ok && res.status !== 409) throw new Error('request failed')
      setSaved((prev) => (prev.includes(athlete.user_id) ? prev : [...prev, athlete.user_id]))
      toast.success('Saved to your shortlist')
    } catch {
      toast.error('Could not save that athlete. Please try again.')
    }
  }

  function handleSwipe(id: string, direction: 'left' | 'right') {
    const athlete = athletes.find((a) => a.id === id)
    setSwiped((prev) => (prev.includes(id) ? prev : [...prev, id]))
    if (direction === 'right' && athlete) void shortlist(athlete)
  }

  return (
    <div className="space-y-6" data-testid="athletes-browser">
      <div className="flex justify-end">
        <BrowseModeToggle value={mode} onChange={setMode} pending={pending} />
      </div>

      {mode === 'swipe' ? (
        <SwipeDeck
          cards={queue.map((a) => ({
            id: a.id,
            image: a.profile_photo_url ?? '/placeholder-athlete.svg',
            imageAlt: a.display_name ?? 'Athlete profile photo',
            title: a.display_name ?? 'Unknown athlete',
            ...(a.primary_sport ? { subtitle: a.primary_sport } : {}),
            ...(a.level ? { seeking: a.level.replace(/_/g, ' ') } : {}),
            ...([a.home_city, a.home_country].filter(Boolean).length
              ? { availability: [a.home_city, a.home_country].filter(Boolean).join(', ') }
              : {}),
            likeLabel: 'Save',
            passLabel: 'Skip',
          }))}
          onSwipe={handleSwipe}
          empty={
            <EmptyState
              title="That is every athlete for now"
              description="Switch to grid view to review them again, or widen your search."
            />
          }
        />
      ) : (
        <AthletesGrid
          athletes={athletes}
          savedUserIds={saved}
          verifiedUserIds={verifiedUserIds}
          footer={footer}
          {...(typeof tier === 'number' ? { tier } : {})}
        />
      )}
    </div>
  )
}
