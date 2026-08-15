'use client'

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Search, SlidersHorizontal, X } from 'lucide-react'

import { cn } from '@/lib/utils'
import { FilterGroup, useFilterDisclosure } from '@/components/ui/filter-group'
import { SPORT_OPTIONS } from '@/lib/sports'
import type { ListingSummary } from '@/lib/supabase/discovery'

/**
 * Shared search / filter / sort logic for the athlete discovery surface.
 *
 * DISC5: both browse modes (grid + swipe) must show the same controls and feed
 * the SAME filtered result set into whatever they render. The state and the
 * filtering therefore live here, in a hook + a presentational toolbar, so the
 * grid and the swipe deck can each render the controls and consume `filtered`
 * without duplicating the logic.
 */

// PR-1: `verified` was a facet that filtered nothing (there is no brand
// verification column), so it stays gone.
export type FacetKey = 'sport' | 'budget' | 'location' | 'industry'

const FACETS: { key: FacetKey; label: string }[] = [
  { key: 'sport', label: 'Sport' },
  { key: 'budget', label: 'Budget' },
  { key: 'location', label: 'Location' },
  { key: 'industry', label: 'Industry' },
]

export const BUDGET_BANDS: { value: string; label: string; min: number; max: number }[] = [
  { value: '0-1000', label: 'Up to £1,000', min: 0, max: 1000 },
  { value: '1000-5000', label: '£1,000 – £5,000', min: 1000, max: 5000 },
  { value: '5000-20000', label: '£5,000 – £20,000', min: 5000, max: 20000 },
  { value: '20000+', label: '£20,000+', min: 20000, max: Infinity },
]

export type SortKey = 'relevance' | 'pay_desc' | 'pay_asc' | 'newest'

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

const DAY_MS = 24 * 60 * 60 * 1000

/**
 * PR-1 (partial) — a real, documented relevance score.
 *
 * - recency  — `1 / (1 + ageDays / 30)`, freshness decays, it does not cliff.
 * - pay      — `pay_amount / maxPay` across the current result set, weight 0.5.
 * - query    — only when the user has typed: +1.5 title, +0.75 sport.
 * - onSport  — DISC6: +1.5 when the listing's sport is the athlete's own primary
 *   sport, so the default Relevance feed surfaces on-sport opportunities first.
 *
 * Ties break on `created_at` descending so the order is stable between renders.
 */
export function relevanceScore(
  listing: ListingSummary,
  opts: { query: string; maxPay: number; now: number; athleteSport?: string | null }
): number {
  const ageDays = Math.max(0, (opts.now - new Date(listing.created_at).getTime()) / DAY_MS)
  const recency = 1 / (1 + ageDays / 30)

  const pay = opts.maxPay > 0 ? (listing.pay_amount ?? 0) / opts.maxPay : 0

  let queryBoost = 0
  if (opts.query) {
    if (listing.title.toLowerCase().includes(opts.query)) queryBoost += 1.5
    if ((listing.sport_required ?? '').toLowerCase().includes(opts.query)) queryBoost += 0.75
  }

  let sportBoost = 0
  if (
    opts.athleteSport &&
    listing.sport_required &&
    listing.sport_required.trim().toLowerCase() === opts.athleteSport.trim().toLowerCase()
  ) {
    sportBoost = 1.5
  }

  return recency + pay * 0.5 + queryBoost + sportBoost
}

/**
 * A chip that opens a listbox. Portalled to the body at `z-[100]` so it never
 * paints behind the results grid; open state is owned by the FilterGroup so
 * exactly one filter is open at a time (PR-17).
 */
function FilterChip({
  id,
  label,
  value,
  options,
  onChange,
}: {
  id: string
  label: string
  value: string | null
  options: { value: string; label: string }[]
  onChange: (v: string | null) => void
}) {
  const { open = false, onOpenChange } = useFilterDisclosure(id)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const popupRef = useRef<HTMLUListElement>(null)
  const [rect, setRect] = useState<{ top: number; left: number; width: number } | null>(null)
  const selected = options.find((o) => o.value === value)
  const active = Boolean(value)

  useLayoutEffect(() => {
    if (!open) return
    const el = triggerRef.current
    if (!el?.getBoundingClientRect) return
    const r = el.getBoundingClientRect()
    setRect({ top: r.bottom + 4, left: r.left, width: Math.max(r.width, 224) })
  }, [open])

  useEffect(() => {
    if (!open) return
    function onPointerDown(e: PointerEvent | MouseEvent) {
      const target = e.target as Node | null
      if (!target) return
      if (popupRef.current?.contains(target) || triggerRef.current?.contains(target)) return
      onOpenChange?.(false)
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        onOpenChange?.(false)
        triggerRef.current?.focus()
      }
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open, onOpenChange])

  function close() {
    onOpenChange?.(false)
  }

  const popup = (
    <ul
      ref={popupRef}
      role="listbox"
      aria-label={label}
      data-testid={`filter-popup-${id}`}
      style={rect ? { top: rect.top, left: rect.left, minWidth: rect.width } : undefined}
      className="fixed z-[100] max-h-64 w-56 overflow-y-auto rounded-lg border border-border bg-popover p-1 shadow-card"
    >
      <li>
        <button
          type="button"
          role="option"
          aria-selected={!value}
          onClick={() => {
            onChange(null)
            close()
          }}
          className="w-full rounded-md px-2 py-1.5 text-left text-medium text-muted-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
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
              close()
            }}
            className={cn(
              'w-full rounded-md px-2 py-1.5 text-left text-medium hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              value === o.value ? 'font-medium text-foreground' : 'text-foreground'
            )}
          >
            {o.label}
          </button>
        </li>
      ))}
    </ul>
  )

  return (
    <div className="shrink-0">
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => onOpenChange?.(!open)}
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

      {open && typeof document !== 'undefined' ? createPortal(popup, document.body) : null}
    </div>
  )
}

const EMPTY_FILTERS: Record<FacetKey, string | null> = {
  sport: null,
  budget: null,
  location: null,
  industry: null,
}

export interface ListingFilters {
  search: string
  setSearch: (v: string) => void
  filters: Record<FacetKey, string | null>
  setFilter: (key: FacetKey, value: string | null) => void
  sort: SortKey
  setSort: (s: SortKey) => void
  filtered: ListingSummary[]
  hasActiveFilters: boolean
  reset: () => void
}

/**
 * Owns the search/filter/sort state and returns the filtered+sorted listings.
 * `athleteSport` (DISC6) feeds the Relevance boost so the default feed surfaces
 * the athlete's own sport.
 */
export function useListingFilters(
  listings: ListingSummary[],
  opts: { athleteSport?: string | null } = {}
): ListingFilters {
  const [search, setSearch] = useState('')
  const [filters, setFilters] = useState<Record<FacetKey, string | null>>(EMPTY_FILTERS)
  const [sort, setSort] = useState<SortKey>('relevance')

  const athleteSport = opts.athleteSport ?? null

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
      return true
    })

    const sorted = [...result]
    if (sort === 'pay_desc') sorted.sort((a, b) => (b.pay_amount ?? 0) - (a.pay_amount ?? 0))
    else if (sort === 'pay_asc') sorted.sort((a, b) => (a.pay_amount ?? 0) - (b.pay_amount ?? 0))
    else if (sort === 'newest') sorted.sort((a, b) => b.created_at.localeCompare(a.created_at))
    else {
      const maxPay = result.reduce((m, l) => Math.max(m, l.pay_amount ?? 0), 0)
      const now = Date.now()
      sorted.sort((a, b) => {
        const diff =
          relevanceScore(b, { query: q, maxPay, now, athleteSport }) -
          relevanceScore(a, { query: q, maxPay, now, athleteSport })
        return diff !== 0 ? diff : b.created_at.localeCompare(a.created_at)
      })
    }
    return sorted
  }, [listings, search, filters, sort, athleteSport])

  const hasActiveFilters =
    search.trim() !== '' || Object.values(filters).some((v) => v !== null)

  return {
    search,
    setSearch,
    filters,
    setFilter: (key, value) => setFilters((prev) => ({ ...prev, [key]: value })),
    sort,
    setSort,
    filtered,
    hasActiveFilters,
    reset: () => {
      setSearch('')
      setFilters(EMPTY_FILTERS)
    },
  }
}

/**
 * The sticky search + sort + filter-chip toolbar (spec §3D.1). Presentational:
 * it renders the controls off a `ListingFilters` instance so grid and swipe
 * modes share one toolbar implementation (DISC5).
 */
export function ListingsToolbar({
  state,
  listings,
}: {
  state: ListingFilters
  /** The full (pre-filter) list — drives the count and the data-derived facets. */
  listings: ListingSummary[]
}) {
  const { search, setSearch, filters, setFilter, sort, setSort, hasActiveFilters, reset } = state

  // Location/industry facets only offer values that actually exist in the data.
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
    // Sport options come from the canonical SPORTS list (DISC6) so every sport —
    // including the athlete's own, e.g. Surfing — is selectable even when no
    // current campaign targets it. Location/industry stay data-derived.
    sport: SPORT_OPTIONS.map((s) => ({ value: s.value, label: s.label })),
    budget: BUDGET_BANDS.map((b) => ({ value: b.value, label: b.label })),
    location: locationOptions,
    industry: industryOptions,
  }

  const searchPlaceholder = `Search ${listings.length} campaigns by sport, brand or location…`

  return (
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
          {/* DISC9: a persistent reset whenever any search/filter is active. */}
          {hasActiveFilters ? (
            <button
              type="button"
              onClick={reset}
              className="inline-flex items-center gap-1 rounded-full border border-border bg-card px-3 py-1.5 text-small text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <X className="size-3.5" aria-hidden="true" />
              Clear all
            </button>
          ) : null}
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

      <FilterGroup className="flex-nowrap overflow-x-auto pb-1">
        {FACETS.map((f) => (
          <FilterChip
            key={f.key}
            id={f.key}
            label={f.label}
            value={filters[f.key]}
            options={facetOptions[f.key]}
            onChange={(v) => setFilter(f.key, v)}
          />
        ))}
      </FilterGroup>
    </div>
  )
}
