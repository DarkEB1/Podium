'use client'

import { useMemo, useState } from 'react'
import { SlidersHorizontal, Sparkles, Users } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { EmptyState } from '@/components/ui/empty-state'
import { ROUTES } from '@/lib/routes'
import AthleteCard from './athlete-card'
import type { AthleteSummary } from '@/lib/supabase/profiles'
import type { Database } from '@/types/database'

type AthleteRow = AthleteSummary
type AvailabilityStatus = Database['public']['Enums']['availability_status']
type AthleteLevel = Database['public']['Enums']['athlete_level']

interface Props {
  athletes: AthleteRow[]
  /** Brand's current subscription tier (1-3). Drives the non-intrusive upgrade banner. */
  tier?: number
  /** Athlete user_ids already on the brand's shortlist (persisted, no request sent). */
  savedUserIds?: string[]
  /** user_ids of verified athletes (Track B verification status). */
  verifiedUserIds?: string[]
  /** Rendered under the grid — the "Load more" affordance for the paginated feed (FA-5). */
  footer?: React.ReactNode
}

const MAX_TIER = 3

const LEVELS: AthleteLevel[] = [
  'recreational',
  'amateur',
  'semi_professional',
  'professional',
  'international',
]

const AVAILABILITY: AvailabilityStatus[] = [
  'available_now',
  'available_from',
  'not_available',
]

function labelize(value: string): string {
  return value
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

function followerCount(athlete: AthleteRow): number {
  const social = athlete.social_accounts as Record<string, unknown> | null
  if (!social) return 0
  let total = 0
  for (const key of ['instagram_followers', 'tiktok_followers', 'youtube_subscribers', 'twitter_followers']) {
    const raw = social[key]
    const n = typeof raw === 'number' ? raw : Number(raw)
    if (Number.isFinite(n)) total = Math.max(total, n)
  }
  return total
}

export default function AthletesGrid({
  athletes,
  tier,
  savedUserIds = [],
  verifiedUserIds = [],
  footer,
}: Props) {
  const [search, setSearch] = useState('')
  const [sport, setSport] = useState('')
  const [level, setLevel] = useState('')
  const [availability, setAvailability] = useState('')
  const [radiusKm, setRadiusKm] = useState('')
  const [minFollowing, setMinFollowing] = useState('')
  const [panelOpen, setPanelOpen] = useState(false)

  const savedSet = useMemo(() => new Set(savedUserIds), [savedUserIds])
  const verifiedSet = useMemo(() => new Set(verifiedUserIds), [verifiedUserIds])

  const sports = useMemo(
    () =>
      Array.from(
        new Set(athletes.map((a) => a.primary_sport).filter((s): s is string => !!s))
      ).sort(),
    [athletes]
  )

  const activeFilterCount =
    (sport ? 1 : 0) +
    (level ? 1 : 0) +
    (availability ? 1 : 0) +
    (radiusKm ? 1 : 0) +
    (minFollowing ? 1 : 0)

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    const radius = radiusKm ? Number(radiusKm) : null
    const minFollowingN = minFollowing ? Number(minFollowing) : null

    return athletes.filter((a) => {
      if (q) {
        const hay = [a.display_name, a.primary_sport, a.home_city, a.home_country, a.level]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
        if (!hay.includes(q)) return false
      }
      if (sport && a.primary_sport !== sport) return false
      if (level && a.level !== level) return false
      if (availability && a.availability_status !== availability) return false
      if (radius != null && (a.travel_radius_km ?? 0) < radius) return false
      if (minFollowingN != null && followerCount(a) < minFollowingN) return false
      return true
    })
  }, [athletes, search, sport, level, availability, radiusKm, minFollowing])

  const showUpgrade = typeof tier === 'number' && tier < MAX_TIER

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2">
        <Input
          placeholder="Search by name, sport, location…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-sm flex-1"
          aria-label="Search athletes"
        />
        {/* Mobile (and small-screen) Filters toggle with active-count badge */}
        <button
          type="button"
          onClick={() => setPanelOpen((o) => !o)}
          aria-expanded={panelOpen}
          className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'gap-2 lg:hidden')}
        >
          <SlidersHorizontal className="size-4" aria-hidden="true" />
          Filters
          {activeFilterCount > 0 ? (
            <span
              className="inline-flex size-5 items-center justify-center rounded-full bg-primary text-small font-medium text-primary-foreground"
              aria-label={`${activeFilterCount} active filters`}
            >
              {activeFilterCount}
            </span>
          ) : null}
        </button>
      </div>

      {/* Filter panel: always visible on lg, collapsible below it */}
      <div
        className={cn(
          'rounded-2xl border border-border bg-card p-6 shadow-sm',
          panelOpen ? 'block' : 'hidden lg:block'
        )}
      >
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div className="space-y-1">
            <Label htmlFor="filter-sport">Sport</Label>
            <select
              id="filter-sport"
              value={sport}
              onChange={(e) => setSport(e.target.value)}
              className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-medium"
            >
              <option value="">All sports</option>
              {sports.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <Label htmlFor="filter-level">Level</Label>
            <select
              id="filter-level"
              value={level}
              onChange={(e) => setLevel(e.target.value)}
              className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-medium"
            >
              <option value="">All levels</option>
              {LEVELS.map((l) => (
                <option key={l} value={l}>
                  {labelize(l)}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <Label htmlFor="filter-availability">Availability</Label>
            <select
              id="filter-availability"
              value={availability}
              onChange={(e) => setAvailability(e.target.value)}
              className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-medium"
            >
              <option value="">Any availability</option>
              {AVAILABILITY.map((a) => (
                <option key={a} value={a}>
                  {labelize(a)}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <Label htmlFor="filter-radius">Location radius (km)</Label>
            <Input
              id="filter-radius"
              type="number"
              min={0}
              inputMode="numeric"
              value={radiusKm}
              onChange={(e) => setRadiusKm(e.target.value)}
              placeholder="Any"
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="filter-following">Min following</Label>
            <Input
              id="filter-following"
              type="number"
              min={0}
              inputMode="numeric"
              value={minFollowing}
              onChange={(e) => setMinFollowing(e.target.value)}
              placeholder="Any"
            />
          </div>

          {/*
            A "Verified athletes only" checkbox used to live here. There is no
            verification column on `athlete_profiles` — the grid was matching
            against a `verifiedUserIds` prop no page ever passed, so ticking it
            always returned zero athletes. A filter that can only ever empty the
            page is worse than no filter; it comes back with the column.
          */}
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={<Users aria-hidden="true" />}
          title="No athletes match your filters"
          description="Try widening your search or clearing a filter to see more athletes."
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((a) => (
            <AthleteCard
              key={a.id}
              athlete={a}
              verified={verifiedSet.has(a.user_id)}
              initialSaved={savedSet.has(a.user_id)}
            />
          ))}
        </div>
      )}

      {footer}

      {showUpgrade ? (
        <aside
          role="complementary"
          aria-label="Upgrade your plan"
          className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-accent/30 bg-accent/10 p-4"
        >
          <div className="flex items-center gap-3">
            <Sparkles className="size-5 text-accent-foreground" aria-hidden="true" />
            <div>
              <p className="text-medium font-medium text-foreground">
                Unlock more athletes and richer filters
              </p>
              <p className="text-small text-muted-foreground">
                Upgrade your plan to reach a wider roster and contact more athletes each month.
              </p>
            </div>
          </div>
          <a
            href={ROUTES.brand.subscription}
            className={cn(buttonVariants({ variant: 'default', size: 'sm' }))}
          >
            See plans
          </a>
        </aside>
      ) : null}
    </div>
  )
}
