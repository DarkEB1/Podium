'use client'

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { motion, useReducedMotion } from 'motion/react'
import { Search, SlidersHorizontal } from 'lucide-react'

import { cn } from '@/lib/utils'
import { SPRING } from '@/lib/motion/springs'
import { CardSkeleton } from '@/components/ui/card-skeleton'
import { EmptyState } from '@/components/ui/empty-state'
import { FilterGroup, useFilterDisclosure } from '@/components/ui/filter-group'
import ListingCard from './listing-card'
import type { ListingSummary } from '@/lib/supabase/discovery'

// PR-19: the grid passes listings straight to ListingCard, which needs the
// brand's *user* id to address a connection request. See ListingSummary.
type GridListing = ListingSummary

interface Props {
  listings: GridListing[]
  /** While true the grid shows skeleton placeholders instead of results (spec §3D.1: skeleton, not spinner). */
  loading?: boolean
  /** Rendered under the grid — the "Load more" affordance for the paginated feed (FA-5). */
  footer?: React.ReactNode
}

// PR-1: `verified` used to be a facet here. It was a hardcoded `return true` —
// a control that filtered nothing. There is no verification column on
// `brand_profiles` (only `status`, an admin-approval state), so rather than
// dress approval up as verification the facet is gone until the column exists.
type FacetKey = 'sport' | 'budget' | 'location' | 'industry'

const FACETS: { key: FacetKey; label: string }[] = [
  { key: 'sport', label: 'Sport' },
  { key: 'budget', label: 'Budget' },
  { key: 'location', label: 'Location' },
  { key: 'industry', label: 'Industry' },
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

const DAY_MS = 24 * 60 * 60 * 1000

/**
 * PR-1 (partial) — a real, documented relevance score.
 *
 * "Relevance" was the default sort and did nothing: the sort block only handled
 * pay and recency, so picking the default left the rows in whatever order the
 * database returned them. Full preference-based ranking is a Phase-4 epic; this
 * is the honest interim heuristic over the data a listing actually carries:
 *
 * - recency  — `1 / (1 + ageDays / 30)`, so a listing posted today scores 1 and
 *   one from ~a month ago scores 0.5. Freshness decays, it does not cliff.
 * - pay      — `pay_amount / maxPay` across the current result set, weight 0.5.
 *   Relative, so one huge listing cannot flatten the rest to zero.
 * - query    — only when the user has typed something: +1.5 if the term is in
 *   the title, +0.75 if it is in the sport. Text the user asked for outranks
 *   both other signals, which is what "relevance" means to them.
 *
 * Ties break on `created_at` descending so the order is stable between renders.
 */
export function relevanceScore(
  listing: GridListing,
  opts: { query: string; maxPay: number; now: number }
): number {
  const ageDays = Math.max(0, (opts.now - new Date(listing.created_at).getTime()) / DAY_MS)
  const recency = 1 / (1 + ageDays / 30)

  const pay = opts.maxPay > 0 ? (listing.pay_amount ?? 0) / opts.maxPay : 0

  let queryBoost = 0
  if (opts.query) {
    if (listing.title.toLowerCase().includes(opts.query)) queryBoost += 1.5
    if ((listing.sport_required ?? '').toLowerCase().includes(opts.query)) queryBoost += 0.75
  }

  return recency + pay * 0.5 + queryBoost
}

/**
 * A chip that opens a listbox.
 *
 * PR-17: the popup used to be an `absolute z-30` child of a `sticky z-20`
 * toolbar, so it painted *behind* the results grid, and each chip owned its own
 * `useState`, so opening a second filter left the first hanging open. It is now
 * portalled to `document.body` at `z-[100]` (no ancestor stacking context can
 * trap it) and its open state is owned by the surrounding FilterGroup, which
 * allows exactly one open filter at a time.
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

  // Position the portalled popup under its trigger. useLayoutEffect so it is
  // placed before paint and never flashes at the top-left of the document.
  useLayoutEffect(() => {
    if (!open) return
    const el = triggerRef.current
    if (!el?.getBoundingClientRect) return
    const r = el.getBoundingClientRect()
    setRect({ top: r.bottom + 4, left: r.left, width: Math.max(r.width, 224) })
  }, [open])

  // Dismiss on outside pointerdown / Escape. Deliberately NOT a full-screen
  // overlay: an overlay would swallow the click that opens the *next* chip, so
  // switching filters would cost two clicks.
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

export default function ListingsGrid({ listings, loading = false, footer }: Props) {
  const [search, setSearch] = useState('')
  const [filters, setFilters] = useState<Record<FacetKey, string | null>>({
    sport: null,
    budget: null,
    location: null,
    industry: null,
  })
  const [sort, setSort] = useState<SortKey>('relevance')

  // Entry-motion guard (UX audit M4): stagger the cards in on the grid's FIRST
  // mount only. `animateFirstMount` is read during render — true on the initial
  // pass, then flipped off after commit — so filter/sort/load-more re-renders
  // (which unmount and remount cards) render statically instead of replaying.
  const reduced = useReducedMotion()
  const firstMountRef = useRef(true)
  const animateFirstMount = firstMountRef.current
  useEffect(() => {
    firstMountRef.current = false
  }, [])
  const cardMotion = (index: number) =>
    animateFirstMount
      ? {
          initial: reduced ? { opacity: 0 } : { opacity: 0, y: 8 },
          animate: { opacity: 1, y: 0 },
          transition: { ...SPRING.default, delay: reduced ? 0 : Math.min(index, 8) * 0.04 },
        }
      : { initial: false as const }

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
          relevanceScore(b, { query: q, maxPay, now }) - relevanceScore(a, { query: q, maxPay, now })
        return diff !== 0 ? diff : b.created_at.localeCompare(a.created_at)
      })
    }
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

        <FilterGroup className="flex-nowrap overflow-x-auto pb-1">
          {FACETS.map((f) => (
            <FilterChip
              key={f.key}
              id={f.key}
              label={f.label}
              value={filters[f.key]}
              options={facetOptions[f.key]}
              onChange={(v) => setFilters((prev) => ({ ...prev, [f.key]: v }))}
            />
          ))}
        </FilterGroup>
      </div>

      <p data-testid="results-count" aria-live="polite" className="text-small text-muted-foreground">
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
          {filtered.map((l, index) => (
            <motion.div key={l.id} {...cardMotion(index)}>
              <ListingCard listing={l} />
            </motion.div>
          ))}
        </div>
      )}

      {footer}
    </div>
  )
}
