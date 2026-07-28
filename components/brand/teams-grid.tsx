'use client'

import { useMemo, useState } from 'react'
import { Users } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { EmptyState } from '@/components/ui/empty-state'
import TeamCard from './team-card'
import type { TeamSummary } from '@/lib/supabase/profiles'
import type { Database } from '@/types/database'

type TeamLevel = Database['public']['Enums']['team_level']

interface Props {
  teams: TeamSummary[]
  /** Team user_ids already on the brand's shortlist. */
  savedUserIds?: string[]
  /** Rendered under the grid — the "Load more" affordance (FA-5). */
  footer?: React.ReactNode
}

const LEVELS: TeamLevel[] = [
  'grassroots',
  'college',
  'semi_pro',
  'professional',
  'international',
]

function labelize(value: string): string {
  return value.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

export default function TeamsGrid({ teams, savedUserIds = [], footer }: Props) {
  const [search, setSearch] = useState('')
  const [sport, setSport] = useState('')
  const [level, setLevel] = useState('')

  const savedSet = useMemo(() => new Set(savedUserIds), [savedUserIds])

  const sports = useMemo(
    () => Array.from(new Set(teams.flatMap((t) => t.sports ?? []).filter(Boolean))).sort(),
    [teams]
  )

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return teams.filter((t) => {
      if (q) {
        const hay = [t.team_name, t.nickname, ...(t.sports ?? []), t.home_city, t.home_country]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
        if (!hay.includes(q)) return false
      }
      if (sport && !(t.sports ?? []).includes(sport)) return false
      if (level && t.competition_level !== level) return false
      return true
    })
  }, [teams, search, sport, level])

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2">
        <Input
          placeholder="Search by name, sport, location…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-sm flex-1"
          aria-label="Search teams"
        />
      </div>

      <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1">
            <Label htmlFor="team-filter-sport">Sport</Label>
            <select
              id="team-filter-sport"
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
            <Label htmlFor="team-filter-level">Competition level</Label>
            <select
              id="team-filter-level"
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
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={<Users aria-hidden="true" />}
          title="No teams match your filters"
          description="Try widening your search or clearing a filter to see more teams."
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((t) => (
            <TeamCard key={t.id} team={t} initialSaved={savedSet.has(t.user_id)} />
          ))}
        </div>
      )}

      {footer}
    </div>
  )
}
