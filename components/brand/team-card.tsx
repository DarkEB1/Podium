'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { MarketplaceCard } from '@/components/ui/marketplace-card'
import { LevelChip } from '@/components/ui/status-badges'
import { copy } from '@/lib/copy'
import { ROUTES } from '@/lib/routes'
import type { TeamSummary } from '@/lib/supabase/profiles'

interface Props {
  team: TeamSummary
  /** Initial shortlist state — supplied by the grid from the persisted shortlist. */
  initialSaved?: boolean
}

function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1).replace(/\.0$/, '')}K`
  return String(n)
}

/** The brand-side discovery card for a team (2.2), mirroring AthleteCard. */
export default function TeamCard({ team, initialSaved = false }: Props) {
  const [saved, setSaved] = useState(initialSaved)
  const [pending, setPending] = useState(false)

  async function toggleSave() {
    if (pending) return
    const next = !saved
    setPending(true)
    setSaved(next)
    try {
      const res = next
        ? await fetch(ROUTES.api.discovery.shortlist, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ target_user_id: team.user_id }),
          })
        : await fetch(ROUTES.api.discovery.shortlistEntry(team.user_id), { method: 'DELETE' })

      if (!res.ok && !(next && res.status === 409)) throw new Error('request failed')
      if (next) toast.success(copy.toasts.saved)
    } catch {
      setSaved(!next)
      toast.error('Could not update your shortlist. Please try again.')
    } finally {
      setPending(false)
    }
  }

  const sport = team.sports?.[0]
  const location = [team.home_city, team.home_country].filter(Boolean).join(', ')
  const subtitle = [sport, location].filter(Boolean).join(' · ')
  const following = team.total_social_following ?? 0
  const stat = following > 0 ? { label: 'followers', value: formatCount(following) } : undefined
  const profileHref = ROUTES.brand.teamProfileFor(team.user_id)

  const tags = team.competition_level ? (
    <LevelChip level={team.competition_level.replace(/_/g, ' ')} />
  ) : null

  return (
    <MarketplaceCard
      image={team.logo_url ?? team.cover_photo_url ?? '/placeholder-cover.svg'}
      imageAlt={team.team_name ?? 'Team logo'}
      title={team.team_name ?? 'Unknown team'}
      tags={tags}
      cta={{ label: 'View profile', href: profileHref }}
      href={profileHref}
      saved={saved}
      onToggleSave={toggleSave}
      {...(subtitle ? { subtitle } : {})}
      {...(stat ? { stat } : {})}
    />
  )
}
