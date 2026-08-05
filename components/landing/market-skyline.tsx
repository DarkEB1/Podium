'use client'

import { useState } from 'react'
import Link from 'next/link'
import { MARKET_PROFILES, SKYLINE_FILTERS } from '@/lib/landing/market-fixtures'

// Minimum height for the focused card so name + mono stat line + View button
// always fit, even for low-deal profiles whose momentum height would
// otherwise be too short (e.g. Tom Forster: 64 + 5 * 4 = 84px, overflowing).
const MIN_FOCUS_HEIGHT = 176

// Marketplace variant A: every profile is a bar of the podium, standing on the
// baseline. Focused bar = the panel's one full-saturation lime element; the
// rest are tints (spec: colour rules). Heights encode momentum.
export default function MarketSkyline() {
  const [filter, setFilter] = useState<(typeof SKYLINE_FILTERS)[number]>('All')
  const [focusId, setFocusId] = useState(MARKET_PROFILES[0]!.id)

  const profiles = MARKET_PROFILES.filter((p) =>
    filter === 'All' ? true : filter === 'Teams' ? p.kind === 'team' : p.sport === filter
  )

  // The active filter can exclude the currently focused profile (e.g. focus
  // is Rita Silva, filter switches to "Teams"). Fall back to the first
  // visible profile so exactly one bar is always focused (colour rule: one
  // full-saturation lime element per panel).
  const activeFocusId = profiles.some((p) => p.id === focusId) ? focusId : profiles[0]?.id

  return (
    <div>
      <div className="mb-6 flex flex-wrap gap-2" role="group" aria-label="Filter profiles">
        {SKYLINE_FILTERS.map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            aria-pressed={filter === f}
            className={`rounded-[10px] px-4 py-2 text-small font-bold transition-colors ${
              filter === f
                ? 'bg-primary text-primary-foreground'
                : 'border border-border bg-card text-foreground'
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      <ul className="flex items-end gap-2" aria-label="Profiles on the podium">
        {profiles.map((p) => {
          const focused = p.id === activeFocusId
          const collapsedHeight = 64 + p.deals * 4
          const height = focused ? Math.max(collapsedHeight, MIN_FOCUS_HEIGHT) : collapsedHeight
          const radius = focused ? '18px 4px 0 0' : 'calc(100% * 0.6 / 3) 4px 0 0' // proportional top-left rounding

          return (
            <li key={p.id} className={focused ? 'flex-[3] min-w-44' : 'flex-1'}>
              {focused ? (
                // Non-interactive container: clicking an already-focused bar
                // is a no-op, so the only interactive descendant is the View
                // link. Keeping it out of a <button> avoids nesting a link
                // inside a button (invalid HTML content model, ambiguous for
                // assistive tech).
                <div
                  style={{ height, borderRadius: radius }}
                  className="flex w-full flex-col justify-between overflow-hidden bg-lime p-3 text-left text-lime-foreground transition-all duration-300 motion-reduce:transition-none"
                >
                  <span>
                    <span className="block font-heading text-medium font-extrabold">{p.name}</span>
                    <span className="mt-1 block font-mono text-small uppercase tracking-[.15em]">
                      {`${p.sport} · ${p.tier} · ${p.deals} DEALS`.toUpperCase()}
                    </span>
                  </span>
                  <Link
                    href="/role-select"
                    className="w-fit rounded-[10px] bg-primary px-4 py-2 text-small font-bold text-primary-foreground"
                  >
                    View
                  </Link>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setFocusId(p.id)}
                  style={{ height, borderRadius: radius }}
                  className="block w-full overflow-hidden bg-lime-tint-1 p-3 text-left align-bottom transition-all duration-300 hover:bg-lime-tint-2 motion-reduce:transition-none"
                >
                  <span className="sr-only">{p.name}</span>
                </button>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
