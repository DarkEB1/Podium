'use client'

import { useState } from 'react'
import { Input } from '@/components/ui/input'
import ListingCard from './listing-card'
import type { Database } from '@/types/database'

type JobListingRow = Database['public']['Tables']['job_listings']['Row']

interface Props { listings: JobListingRow[] }

export default function ListingsGrid({ listings }: Props) {
  const [search, setSearch] = useState('')

  const filtered = listings.filter((l) => {
    if (!search) return true
    const q = search.toLowerCase()
    return (
      l.title.toLowerCase().includes(q) ||
      l.sport_required?.toLowerCase().includes(q) ||
      l.description?.toLowerCase().includes(q) ||
      l.location?.toLowerCase().includes(q)
    )
  })

  return (
    <div className="space-y-4">
      <Input
        placeholder="Search by sport, title, location…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="max-w-sm"
      />
      {filtered.length === 0 ? (
        <p className="text-center text-muted-foreground py-12">No listings match your search.</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((l) => <ListingCard key={l.id} listing={l} />)}
        </div>
      )}
    </div>
  )
}
