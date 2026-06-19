'use client'

import { useMemo, useRef, useState } from 'react'
import { Search, SlidersHorizontal } from 'lucide-react'

import { cn } from '@/lib/utils'
import { CardSkeleton } from '@/components/ui/card-skeleton'
import { EmptyState } from '@/components/ui/empty-state'
import ListingCard from './listing-card'
import type { Database } from '@/types/database'

type JobListingRow = Database['public']['Tables']['job_listings']['Row']

interface Props {
  listings: JobListingRow[]
  /** While true the grid shows skeleton placeholders instead of results (spec §3D.1: skeleton, not spinner). */
  loading?: boolean
}

type FacetKey = 'sport' | 'budget' | 'location' | 'industry' | 'verified'

const FACETS: { key: FacetKey; label: string }[] = [
  { key: 'sport', label: 'Sport' },
  { key: 'budget', label: 'Budget' },
  { key: 'location', label: 'Location' },
  { key: 'industry', label: 'Industry' },
  { key: 'verified', label: 'Verified' },
]

const BUDGET_BANDS: { value: string; label: string; min: number; max: number }[] = [
  { value: '0-1000', label: 'Up to £1,000', min: 0, max: 1000 },
  { value: '1000-5000', label: '£1,000 – £5,000', min: 1000, max: 5000 },
  { value: '5000-20000', label: '£5,000 – £20,000', min: 5000, max: 20000 },
  { value: '20000+', label: '£20,000+', min: 20000, max: Infinity },
]

type SortKey = 'relevance' | 'pay_desc' | 'pay_asc' | 'newest'

const SORTS: { value: SortKey; label: string }[] = [
  { value: 'relevance', label: 'Relevance' },
  { value: 'newest', label: 'Newest' },
  { value: 'pay_desc', label: 'Pay: high to low' },
  { value: 'pay_asc', label: 'Pay: low to high' },
]

function uniqueSorted(values: (string | null | undefined)[]): string[] {
  return Array.from(new Set(values.filter((v): v is string => Boolean(v)))).sort((a, b) =>
    a.localeCompare(b)
  )
}

/** Lightweight chip dropdown: a toggle button plus a listbox of selectable options. */
function FilterChip({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: string | null
  options: { value: string; label: string }[]
  onChange: (v: string | null) => void
}) {
  const [open, setOpen] = useState(false)
  const selected = options.find((o) => o.value === value)
  const active = Boolean(value)

  return (
    <div className="relative shrink-0">
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className={cn(
          'inline-flex items-center gap-1 rounded-full border px-4 py-1.5 text-medium transition-colors',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
          active
            ? 'border-primary bg-primary/10 text-foreground'
            : 'border-border bg-card text-muted-foreground hover:text-foreground'
        )}
      >
        {selected ? `${label}: ${selected.label}` : label}
      </button>

      {open && (
        <ul
          role="listbox"
          aria-label={label}
          className="absolute left-0 top-full z-30 mt-1 max-h-64 w-56 overflow-y-auto rounded-lg border border-border bg-popover p-1 shadow-card"
        >
          <li>
            <button
              type="button"
              role="option"
              aria-selected={!value}
              onClick={() => {
                onChange(null)
                setOpen(false)
              }}
              className="w-full rounded-md px-2 py-1.5 text-left text-medium text-muted-foreground hover:bg-muted"
            >
              Any {label.toLowerCase()}
            </button>
          </li>
          {options.map((o) => (
            <li key={o.value}>
              <button
                type="button"
                role="option"
                aria-selected={value === o.value}
                onClick={() => {
                  onChange(o.value)
                  setOpen(false)
                }}
                className={cn(
                  'w-full rounded-md px-2 py-1.5 text-left text-medium hover:bg-muted',
                  value === o.value ? 'font-medium text-foreground' : 'text-foreground'
                )}
              >
                {o.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export default function ListingsGrid({ listings, loading = false }: Props) {
  const [search, setSearch] = useState('')
  const [filters, setFilters] = useState<Record<FacetKey, string | null>>({
    sport: null,
    budget: null,
    location: null,
    industry: null,
    verified: null,
  })
  const [sort, setSort] = useState<SortKey>('relevance')
  const liveRef = useRef<HTMLParagraphElement>(null)

  const sportOptions = useMemo(
    () => uniqueSorted(listings.map((l) => l.sport_required)).map((s) => ({ value: s, label: s })),
    [listings]
  )
  const locationOptions = useMemo(
    () =>
      uniqueSorted(listings.map((l) => (l.is_remote ? 'Remote' : l.location))).map((s) => ({
        value: s,
        label: s,
      })),
    [listings]
  )
  const industryOptions = useMemo(
    () => uniqueSorted(listings.map((l) => l.type)).map((t) => ({ value: t, label: t.replace(/_/g, ' ') })),
    [listings]
  )

  const facetOptions: Record<FacetKey, { value: string; label: string }[]> = {
    sport: sportOptions,
    budget: BUDGET_BANDS.map((b) => ({ value: b.value, label: b.label })),
    location: locationOptions,
    industry: industryOptions,
    verified: [{ value: 'verified', label: 'Verified brands only' }],
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    const band = BUDGET_BANDS.find((b) => b.value === filters.budget)

    const result = listings.filter((l) => {
      if (q) {
        const haystack = [l.title, l.sport_required, l.description, l.location]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
        if (!haystack.includes(q)) return false
      }
      if (filters.sport && l.sport_required !== filters.sport) return false
      if (filters.location && (l.is_remote ? 'Remote' : l.location) !== filters.location)
        return false
      if (filters.industry && l.type !== filters.industry) return false
      if (band) {
        const pay = l.pay_amount ?? 0
        if (pay < band.min || pay > band.max) return false
      }
      // "verified" is a placeholder facet until brand verification lands in the feed query.
      return true
    })

    const sorted = [...result]
    if (sort === 'pay_desc') sorted.sort((a, b) => (b.pay_amount ?? 0) - (a.pay_amount ?? 0))
    else if (sort === 'pay_asc') sorted.sort((a, b) => (a.pay_amount ?? 0) - (b.pay_amount ?? 0))
    else if (sort === 'newest')
      sorted.sort((a, b) => b.created_at.localeCompare(a.created_at))
    return sorted
  }, [listings, search, filters, sort])

  const searchPlaceholder = `Search ${listings.length} campaigns by sport, brand or location…`

  return (
    <div className="space-y-6">
      {/* Sticky toolbar: search + filter chips + sort (spec §3D.1) */}
      <div
        data-testid="discover-toolbar"
        className="sticky top-0 z-20 -mx-6 space-y-3 border-b border-border bg-background/95 px-6 py-4 backdrop-blur supports-backdrop-filter:bg-background/80 md:-mx-16 md:px-16"
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <input
              type="search"
              aria-label="Search campaigns"
              placeholder={searchPlaceholder}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-10 w-full rounded-full border border-input bg-card pl-9 pr-3 text-medium outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50"
            />
          </div>

          <div className="flex items-center gap-2">
            <label htmlFor="discover-sort" className="flex items-center gap-1 text-small text-muted-foreground">
              <SlidersHorizontal className="size-4" aria-hidden="true" />
              <span>Sort</span>
            </label>
            <select
              id="discover-sort"
              value={sort}
              onChange={(e) => setSort(e.target.value as SortKey)}
              className="h-9 rounded-lg border border-input bg-card px-2 text-medium outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50"
            >
              {SORTS.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex gap-2 overflow-x-auto pb-1">
          {FACETS.map((f) => (
            <FilterChip
              key={f.key}
              label={f.label}
              value={filters[f.key]}
              options={facetOptions[f.key]}
              onChange={(v) => setFilters((prev) => ({ ...prev, [f.key]: v }))}
            />
          ))}
        </div>
      </div>

      <p
        ref={liveRef}
        data-testid="results-count"
        aria-live="polite"
        className="text-small text-muted-foreground"
      >
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
        />
      ) : (
        <div
          data-testid="listings-grid"
          className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3"
        >
          {filtered.map((l) => (
            <ListingCard key={l.id} listing={l} />
          ))}
        </div>
      )}
    </div>
  )
}
