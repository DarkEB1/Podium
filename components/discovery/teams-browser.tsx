'use client'

import { useState } from 'react'
import { toast } from 'sonner'

import { BrowseModeToggle, type BrowseMode } from '@/components/ui/browse-mode-toggle'
import { SwipeDeck } from '@/components/ui/swipe-card'
import { EmptyState } from '@/components/ui/empty-state'
import TeamsGrid from '@/components/brand/teams-grid'
import { ROUTES } from '@/lib/routes'
import type { TeamSummary } from '@/lib/supabase/profiles'

import { useBrowseMode } from './use-browse-mode'

interface Props {
  teams: TeamSummary[]
  /** Persisted `profiles.discovery_ui_mode` for this brand. */
  initialMode: BrowseMode
  savedUserIds?: string[]
  footer?: React.ReactNode
}

/**
 * TeamsBrowser — 2.2, the brand-side team mirror of AthletesBrowser. Swiping
 * "Save" runs the same shortlist mutation as the grid's bookmark.
 */
export default function TeamsBrowser({ teams, initialMode, savedUserIds = [], footer }: Props) {
  const { mode, setMode, pending } = useBrowseMode(initialMode)
  const [swiped, setSwiped] = useState<string[]>([])
  const [saved, setSaved] = useState<string[]>(savedUserIds)

  const queue = teams.filter((t) => !swiped.includes(t.id))

  async function shortlist(team: TeamSummary) {
    try {
      const res = await fetch(ROUTES.api.discovery.shortlist, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target_user_id: team.user_id }),
      })
      if (!res.ok && res.status !== 409) throw new Error('request failed')
      setSaved((prev) => (prev.includes(team.user_id) ? prev : [...prev, team.user_id]))
      toast.success('Saved to your shortlist')
    } catch {
      toast.error('Could not save that team. Please try again.')
    }
  }

  function handleSwipe(id: string, direction: 'left' | 'right') {
    const team = teams.find((t) => t.id === id)
    setSwiped((prev) => (prev.includes(id) ? prev : [...prev, id]))
    if (direction === 'right' && team) void shortlist(team)
  }

  return (
    <div className="space-y-6" data-testid="teams-browser">
      <div className="flex justify-end">
        <BrowseModeToggle value={mode} onChange={setMode} pending={pending} />
      </div>

      {mode === 'swipe' ? (
        <SwipeDeck
          cards={queue.map((t) => ({
            id: t.id,
            image: t.logo_url ?? t.cover_photo_url ?? '/placeholder-cover.svg',
            imageAlt: t.team_name ?? 'Team logo',
            title: t.team_name ?? 'Unknown team',
            ...(t.sports?.[0] ? { subtitle: t.sports[0] } : {}),
            ...(t.competition_level ? { seeking: t.competition_level.replace(/_/g, ' ') } : {}),
            ...([t.home_city, t.home_country].filter(Boolean).length
              ? { availability: [t.home_city, t.home_country].filter(Boolean).join(', ') }
              : {}),
            likeLabel: 'Save',
            passLabel: 'Skip',
          }))}
          onSwipe={handleSwipe}
          empty={
            <EmptyState
              title="That is every team for now"
              description="Switch to grid view to review them again, or widen your search."
            />
          }
        />
      ) : (
        <TeamsGrid teams={teams} savedUserIds={saved} footer={footer} />
      )}
    </div>
  )
}
