'use client'

import { useState } from 'react'
import { Zap } from 'lucide-react'
import { toast } from 'sonner'
import { MarketplaceCard } from '@/components/ui/marketplace-card'
import {
  AvailabilityBadge,
  VerifiedBadge,
  LevelChip,
} from '@/components/ui/status-badges'
import { copy } from '@/lib/copy'
import { ROUTES } from '@/lib/routes'
import type { AthleteSummary } from '@/lib/supabase/profiles'

/** The projected shape the discovery feed returns — see ATHLETE_SUMMARY_COLUMNS. */
type AthleteRow = AthleteSummary

interface Props {
  athlete: AthleteRow
  /** Whether this athlete has a verified profile (from Track B verification status). */
  verified?: boolean
  /** Initial shortlist state — supplied by the grid from the persisted shortlist. */
  initialSaved?: boolean
}

const RESPONDS_QUICKLY_WINDOW_MS = 24 * 60 * 60 * 1000

function respondsQuickly(lastActiveAt: string | null): boolean {
  if (!lastActiveAt) return false
  const last = new Date(lastActiveAt).getTime()
  if (Number.isNaN(last)) return false
  return Date.now() - last < RESPONDS_QUICKLY_WINDOW_MS
}

function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1).replace(/\.0$/, '')}K`
  return String(n)
}

/** Pull a single headline follower count from the social_accounts JSON, if present. */
function followerStat(athlete: AthleteRow): { label: string; value: string } | undefined {
  const social = athlete.social_accounts as Record<string, unknown> | null
  if (!social) return undefined
  const candidates = [
    'instagram_followers',
    'tiktok_followers',
    'youtube_subscribers',
    'twitter_followers',
  ]
  for (const key of candidates) {
    const raw = social[key]
    const n = typeof raw === 'number' ? raw : Number(raw)
    if (Number.isFinite(n) && n > 0) {
      return { label: 'followers', value: formatCount(n) }
    }
  }
  return undefined
}

export default function AthleteCard({ athlete, verified = false, initialSaved = false }: Props) {
  const [saved, setSaved] = useState(initialSaved)
  const [pending, setPending] = useState(false)

  async function toggleSave() {
    if (pending) return
    const next = !saved
    setPending(true)
    // optimistic flip so the bookmark responds instantly
    setSaved(next)
    try {
      const res = next
        ? await fetch(ROUTES.api.discovery.shortlist, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ target_user_id: athlete.user_id }),
          })
        : await fetch(ROUTES.api.discovery.shortlistEntry(athlete.user_id), { method: 'DELETE' })

      // 409 ALREADY_SHORTLISTED is a benign no-op when adding
      if (!res.ok && !(next && res.status === 409)) {
        throw new Error('request failed')
      }
      if (next) toast.success(copy.toasts.saved)
    } catch {
      setSaved(!next)
      toast.error('Could not update your shortlist. Please try again.')
    } finally {
      setPending(false)
    }
  }

  const sportLevel = [athlete.primary_sport, athlete.level?.replace(/_/g, ' ')]
    .filter(Boolean)
    .join(' · ')

  const location = [athlete.home_city, athlete.home_country].filter(Boolean).join(', ')
  const subtitle = [sportLevel, location].filter(Boolean).join(' · ')
  const stat = followerStat(athlete)
  const profileHref = `${ROUTES.brand.discover}/${athlete.user_id}`

  const overlayBadges = (
    <>
      {verified ? <VerifiedBadge verified /> : null}
      {athlete.availability_status ? (
        <AvailabilityBadge
          status={athlete.availability_status}
          {...(athlete.available_from_date ? { date: athlete.available_from_date } : {})}
        />
      ) : null}
    </>
  )

  const tags = (
    <>
      {athlete.level ? <LevelChip level={athlete.level.replace(/_/g, ' ')} /> : null}
      {respondsQuickly(athlete.last_active_at) ? (
        <span
          className="inline-flex items-center gap-1 rounded-full bg-success/15 px-2 py-0.5 text-small font-medium text-success"
          data-testid="responds-quickly"
        >
          <Zap className="size-3" aria-hidden="true" />
          Responds quickly
        </span>
      ) : null}
    </>
  )

  return (
    <MarketplaceCard
      image={athlete.profile_photo_url ?? '/placeholder-athlete.svg'}
      imageAlt={athlete.display_name ?? 'Athlete profile photo'}
      title={athlete.display_name ?? 'Unknown athlete'}
      overlayBadges={overlayBadges}
      tags={tags}
      // B-4/PR-20: both the CTA and the card body open the athlete's detail
      // page. `/brand/discover/[userId]` now exists — the athlete-owned
      // `/athlete/profile/[userId]` is behind the athlete-only layout.
      cta={{ label: 'View profile', href: profileHref }}
      href={profileHref}
      saved={saved}
      onToggleSave={toggleSave}
      {...(subtitle ? { subtitle } : {})}
      {...(stat ? { stat } : {})}
    />
  )
}
