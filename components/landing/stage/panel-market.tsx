'use client'

import { useEffect, useRef, useState } from 'react'
import { useStage } from './stage'
import { FIXTURES, type MarketFixture } from './market-fixtures'

// Panel 02 · Marketplace (build spec v3 §3 P02, §5.1): the skyline. A row of
// profile bars standing on the floor line, each one a listing you can inspect.
// The rally variant was cut on founder review (2026-08-10) in favour of this.
// All per-frame animation is imperative (refs + rAF or CSS transitions);
// React state changes only on discrete events.

const DWELL_P = 0.27 // panel 02 rest point (track-map REST_POINTS[1])

export default function PanelMarket() {
  return (
    <section
      aria-labelledby="market-heading"
      className="relative h-screen w-screen shrink-0"
      data-panel="02"
    >
      {/* kicker */}
      <p
        className="absolute flex items-center gap-3 font-mono text-[10.5px] uppercase tracking-[.15em] text-foreground"
        style={{ left: 'var(--margin-x)', top: '12vh' }}
      >
        <span aria-hidden="true" className="inline-block h-[3px] w-5 bg-lime" />
        02 · MARKETPLACE
      </p>

      {/* headline: display-l, deliberately quieter than the hero — the skyline
          is the subject of this panel */}
      <h2
        id="market-heading"
        className="absolute font-heading font-extrabold text-foreground"
        style={{
          left: 'var(--margin-x)',
          top: '16vh',
          fontSize: 'var(--display-l)',
          lineHeight: 0.98,
          letterSpacing: '-0.02em',
        }}
      >
        <span className="block">Every profile</span>
        <span className="block">is a podium.</span>
      </h2>

      <Skyline />
    </section>
  )
}

// ————————————————————————————————————————————————————————————————————————
// Shared spec card: white card, 1.5px ink border, glyph-radius corner, mono
// header with a SAMPLE tag. Content comes exclusively from FIXTURES.
// ————————————————————————————————————————————————————————————————————————

function SpecCard({ fixture }: { fixture: MarketFixture }) {
  return (
    <div
      className="w-[248px] border-[1.5px] border-foreground bg-card p-4"
      style={{ borderRadius: '28px 12px 12px 12px' }}
    >
      <p className="flex items-center justify-between font-mono text-[10.5px] uppercase tracking-[.15em] text-muted-foreground">
        <span>{fixture.role}</span>
        <span>SAMPLE</span>
      </p>
      <p className="mt-2 font-heading text-[17px] font-extrabold leading-tight text-foreground">
        {fixture.title}
      </p>
      <p className="mt-1 text-[12.5px] font-light text-muted-foreground">
        {fixture.level} · {fixture.region}
      </p>
      <p className="mt-3 border-t border-foreground/10 pt-3 font-mono text-[11px] uppercase tracking-[.15em] text-foreground">
        ASKS FROM £{fixture.asksFrom} / SEASON
      </p>
      <ul className="mt-2 space-y-1 text-[12.5px] font-light text-muted-foreground">
        {fixture.gets.map((line) => (
          <li key={line} className="flex items-start gap-2">
            <span aria-hidden="true" className="mt-[7px] inline-block h-[3px] w-3 shrink-0 bg-lime" />
            {line}
          </li>
        ))}
      </ul>
    </div>
  )
}

// ————————————————————————————————————————————————————————————————————————
// VARIANT A · SKYLINE (§5.1, scoped): 12 bars standing on the floor line,
// one per fixture. Hover/focus grows the bar 8% from its base and raises a
// spec card above it; the featured bar's card shows until the first hover.
// ————————————————————————————————————————————————————————————————————————

type BarTone = 'ink85' | 'ink70' | 'ink60' | 'lime' | 'featured'

// Hand-authored field: widths 2.5..4vw, heights 8..34vh, no two adjacent
// heights within 4vh, tallest at ~60% across. Index-paired with FIXTURES.
const BARS: readonly { w: number; h: number; tone: BarTone }[] = [
  { w: 3.0, h: 14, tone: 'ink85' },
  { w: 3.6, h: 26, tone: 'ink70' },
  { w: 2.6, h: 9, tone: 'lime' },
  { w: 3.2, h: 20, tone: 'ink85' },
  { w: 3.8, h: 31, tone: 'ink70' },
  { w: 2.8, h: 12, tone: 'ink60' },
  { w: 3.4, h: 22, tone: 'ink85' },
  { w: 4.0, h: 34, tone: 'featured' },
  { w: 3.0, h: 16, tone: 'ink70' },
  { w: 3.6, h: 27, tone: 'lime' },
  { w: 2.5, h: 10, tone: 'ink60' },
  { w: 3.2, h: 19, tone: 'ink85' },
]

const FEATURED_INDEX = 7
const FIELD_MAX_VH = 34 // tallest authored bar; the field container's height

const TONE_CLASS: Record<BarTone, string> = {
  ink85: 'bg-foreground/85',
  ink70: 'bg-foreground/70',
  ink60: 'bg-foreground/60',
  lime: 'bg-lime',
  featured: 'bg-lime-tint-1',
}

function Skyline() {
  const stage = useStage()
  const fieldRef = useRef<HTMLDivElement>(null)
  // Discrete-event state only: which bar's card is up. The featured bar's
  // card shows by default until the first hover/focus replaces it.
  const [activeIdx, setActiveIdx] = useState<number | null>(FEATURED_INDEX)

  // Subtle parallax around the dwell: an imperative transform write per
  // frame, a few px either side of rest, no React state involved.
  useEffect(
    () =>
      stage.subscribe((p) => {
        const el = fieldRef.current
        if (!el) return
        const x = Math.max(-18, Math.min(18, (DWELL_P - p) * 300))
        el.style.transform = `translate3d(${x.toFixed(2)}px, 0, 0)`
      }),
    [stage]
  )

  return (
    <>
      {/* the field: right ~60vw, bars bottoming out ON the floor line */}
      <div
        ref={fieldRef}
        className="absolute flex items-end justify-end will-change-transform"
        style={{
          right: 'var(--margin-x)',
          width: '60vw',
          top: `calc(var(--floor-y) - ${FIELD_MAX_VH}vh)`,
          height: `${FIELD_MAX_VH}vh`,
          gap: '1.2vw',
        }}
      >
        {FIXTURES.map((fixture, i) => {
          const bar = BARS[i]
          if (!bar) return null
          const active = activeIdx === i
          return (
            <div
              key={fixture.id}
              className="relative flex h-full items-end"
              style={{ width: `${bar.w}vw` }}
            >
              {active && (
                <div
                  className="pointer-events-none absolute z-20"
                  style={{
                    bottom: `calc(${(bar.h * 1.08).toFixed(1)}vh + 12px)`,
                    ...(i >= BARS.length - 3
                      ? { right: 0 }
                      : { left: '50%', transform: 'translateX(-50%)' }),
                  }}
                >
                  <SpecCard fixture={fixture} />
                </div>
              )}
              <div
                role="button"
                tabIndex={0}
                aria-label={`${fixture.title}, ${fixture.level}, ${fixture.region}, asks from £${fixture.asksFrom} a season`}
                className={`w-full cursor-pointer transition-[transform,background-color] duration-200 ease-out ${
                  active ? 'bg-primary' : TONE_CLASS[bar.tone]
                }`}
                style={{
                  height: `${bar.h}vh`,
                  transformOrigin: 'bottom',
                  transform: active ? 'scaleY(1.08)' : undefined,
                  // brand glyph radii: top-left 60% of width, others 12%
                  borderRadius: `${(bar.w * 0.6).toFixed(2)}vw ${(bar.w * 0.12).toFixed(2)}vw ${(bar.w * 0.12).toFixed(2)}vw ${(bar.w * 0.12).toFixed(2)}vw`,
                }}
                onMouseEnter={() => setActiveIdx(i)}
                onMouseLeave={() => setActiveIdx(null)}
                onFocus={() => setActiveIdx(i)}
                onBlur={() => setActiveIdx(null)}
              />
            </div>
          )
        })}
      </div>

      {/* mono caption strip (sub-baseline). One line below the fixed
          wayfinding counter, which owns the floor-plus-12px slot at C1. */}
      <p
        aria-hidden="true"
        className="absolute font-mono text-[10.5px] uppercase tracking-[.15em] text-foreground/40"
        style={{ left: 'var(--margin-x)', top: 'calc(var(--floor-y) + 34px)' }}
      >
        EVERY BAR IS A LIVE PROFILE · HOVER TO INSPECT
      </p>
    </>
  )
}
