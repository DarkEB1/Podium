'use client'

import { useState } from 'react'
import { Input } from '@/components/ui/input'
import AthleteCard from './athlete-card'
import type { Database } from '@/types/database'

type AthleteRow = Database['public']['Tables']['athlete_profiles']['Row']

interface Props { athletes: AthleteRow[] }

export default function AthletesGrid({ athletes }: Props) {
  const [search, setSearch] = useState('')

  const filtered = athletes.filter((a) => {
    if (!search) return true
    const q = search.toLowerCase()
    return (
      a.display_name?.toLowerCase().includes(q) ||
      a.primary_sport?.toLowerCase().includes(q) ||
      a.home_city?.toLowerCase().includes(q) ||
      a.home_country?.toLowerCase().includes(q) ||
      a.level?.toLowerCase().includes(q)
    )
  })

  return (
    <div className="space-y-4">
      <Input
        placeholder="Search by name, sport, location…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="max-w-sm"
      />
      {filtered.length === 0 ? (
        <p className="text-center text-muted-foreground py-12">No athletes match your search.</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((a) => <AthleteCard key={a.id} athlete={a} />)}
        </div>
      )}
    </div>
  )
}
