'use client'

import { useState } from 'react'
import Link from 'next/link'
import { MARKET_PROFILES, SKYLINE_FILTERS } from '@/lib/landing/market-fixtures'

// Marketplace variant A: every profile is a bar of the podium, standing on the
// baseline. Focused bar = the panel's one full-saturation lime element; the
// rest are tints (spec: colour rules). Heights encode momentum.
export default function MarketSkyline() {
  const [filter, setFilter] = useState<(typeof SKYLINE_FILTERS)[number]>('All')
  const [focusId, setFocusId] = useState(MARKET_PROFILES[0]!.id)

  const profiles = MARKET_PROFILES.filter((p) =>
    filter === 'All' ? true : filter === 'Teams' ? p.kind === 'team' : p.sport === filter
  )

  return (
    <div>
      <div className="mb-6 flex flex-wrap gap-2" role="group" aria-label="Filter profiles">
        {SKYLINE_FILTERS.map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
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
          const focused = p.id === focusId
          const height = 64 + p.deals * 4
          return (
            <li key={p.id} className={focused ? 'flex-[3] min-w-44' : 'flex-1'}>
              <button
                type="button"
                onClick={() => setFocusId(p.id)}
                aria-expanded={focused}
                style={{
                  height,
                  borderRadius: focused
                    ? '18px 4px 0 0'
                    : 'calc(100% * 0.6 / 3) 4px 0 0', // proportional top-left rounding
                }}
                className={`block w-full overflow-hidden p-3 text-left align-bottom transition-all duration-300 motion-reduce:transition-none ${
                  focused ? 'bg-lime' : 'bg-lime-tint-1 hover:bg-lime-tint-2'
                }`}
              >
                {focused ? (
                  <span className="flex h-full flex-col justify-between text-foreground">
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
                  </span>
                ) : (
                  <span className="sr-only">{p.name}</span>
                )}
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
