'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useStage } from './stage'
import { FIXTURES, type MarketFixture } from './market-fixtures'

// Panel 02 · Marketplace (build spec v3 §3 P02, §5.1/§5.2). Two variants share
// the hero's shell (kicker, display-l headline, floor discipline): SKYLINE is
// a row of profile bars standing on the floor line, RALLY is a playable core
// of the tennis loop. All per-frame animation is imperative (refs + rAF or CSS
// transitions); React state changes only on discrete events.

const DWELL_P = 0.27 // panel 02 rest point (track-map REST_POINTS[1])

type PanelMarketProps = { variant: 'skyline' | 'rally' }

export default function PanelMarket({ variant }: PanelMarketProps) {
  const lines =
    variant === 'rally' ? ['Sponsorship', 'is a rally.'] : ['Every profile', 'is a podium.']
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
        {lines.map((l) => (
          <span key={l} className="block">
            {l}
          </span>
        ))}
      </h2>

      {variant === 'rally' ? <Rally /> : <Skyline />}
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

// ————————————————————————————————————————————————————————————————————————
// VARIANT B · RALLY (§5.2, playable core): the ball arcs between the lime
// wall and the receiver bar; click anywhere (or Space when focused) inside
// the hit window returns it and cycles the profile card. A miss rolls the
// ball along the floor line and play resets after 1.2s. Reduced motion gets
// static cards with prev/next buttons instead of the game.
// ————————————————————————————————————————————————————————————————————————

const WALL_X = 42 // vw, serve origin in front of the wall
const PLAYER_X = 86 // vw, receiver baseline
const FLIGHT_S = 1.35 // seconds per crossing
const APEX_VH = 26 // arc apex height
const HIT_T = 0.72 // hit window opens at this flight fraction
const FLOOR_FRACTION = 0.8 // keep in sync with --floor-y (80vh)
const BALL_R = 7 // px, half of the 14px ball

type RallyPhase = 'pause' | 'flight' | 'roll'

type RallySim = {
  phase: RallyPhase
  timer: number
  t: number
  fromX: number
  toX: number
  toPlayer: boolean
  rollX: number
  rollV: number
}

function Rally() {
  const stage = useStage()
  const ballRef = useRef<HTMLDivElement>(null)
  const receiverRef = useRef<HTMLDivElement>(null)
  const nearRef = useRef(false)
  const sim = useRef<RallySim>({
    phase: 'pause',
    timer: 1,
    t: 0,
    fromX: WALL_X,
    toX: PLAYER_X,
    toPlayer: true,
    rollX: PLAYER_X,
    rollV: 0,
  })
  // Discrete-event state only: score and which fixture the rail shows.
  const [count, setCount] = useState(0)
  const [railIdx, setRailIdx] = useState(0)
  const [reduced, setReduced] = useState(false)

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    setReduced(mq.matches)
    const onChange = (e: MediaQueryListEvent) => setReduced(e.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  // Only simulate while the corridor is near this panel's dwell.
  useEffect(
    () =>
      stage.subscribe((p) => {
        nearRef.current = p > 0.19 && p < 0.36
      }),
    [stage]
  )

  useEffect(() => {
    if (reduced) return
    let raf = 0
    let last = performance.now()
    const loop = (now: number) => {
      const dt = Math.min((now - last) / 1000, 1 / 30)
      last = now
      if (nearRef.current) {
        const s = sim.current
        if (s.phase === 'pause') {
          s.timer -= dt
          if (s.timer <= 0) {
            s.phase = 'flight'
            s.t = 0
            s.fromX = WALL_X
            s.toX = PLAYER_X
            s.toPlayer = true
          }
        } else if (s.phase === 'flight') {
          s.t += dt / FLIGHT_S
          if (s.t >= 1) {
            if (s.toPlayer) {
              // missed: the ball rolls along the floor line, then play resets
              s.phase = 'roll'
              s.timer = 1.2
              s.rollX = PLAYER_X
              s.rollV = 14
              setCount(0)
            } else {
              // the wall never drops the ball: brief beat, then re-serve
              s.phase = 'pause'
              s.timer = 0.15
            }
          }
        } else {
          s.timer -= dt
          s.rollX += s.rollV * dt
          s.rollV = Math.max(0, s.rollV - 24 * dt)
          if (s.timer <= 0) {
            s.phase = 'pause'
            s.timer = 0.6
          }
        }
        const el = ballRef.current
        if (el) {
          const vw = window.innerWidth / 100
          const vh = window.innerHeight / 100
          const floorPx = FLOOR_FRACTION * window.innerHeight - BALL_R
          let xPx: number
          let yPx: number
          if (s.phase === 'flight') {
            xPx = (s.fromX + (s.toX - s.fromX) * s.t) * vw
            yPx = floorPx - APEX_VH * vh * 4 * s.t * (1 - s.t)
          } else if (s.phase === 'roll') {
            xPx = s.rollX * vw
            yPx = floorPx
          } else {
            xPx = WALL_X * vw
            yPx = floorPx
          }
          el.style.transform = `translate3d(${(xPx - BALL_R).toFixed(1)}px, ${(yPx - BALL_R).toFixed(1)}px, 0)`
        }
        // hit-window affordance: the receiver turns blue while returnable
        const rec = receiverRef.current
        if (rec) {
          const hot = s.phase === 'flight' && s.toPlayer && s.t >= HIT_T
          rec.style.backgroundColor = hot ? 'var(--primary)' : 'var(--foreground)'
        }
      }
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [reduced])

  const tryReturn = useCallback(() => {
    const s = sim.current
    if (s.phase !== 'flight' || !s.toPlayer || s.t < HIT_T) return
    // return flight starts from the ball's current x so nothing teleports
    s.fromX = s.fromX + (s.toX - s.fromX) * s.t
    s.toX = WALL_X
    s.toPlayer = false
    s.t = 0
    setCount((c) => c + 1)
    setRailIdx((i) => (i + 1) % FIXTURES.length)
  }, [])

  const railFixture = FIXTURES[railIdx] ?? FIXTURES[0]

  if (reduced) {
    // Reduced motion: no ball, no animation — a static rail with blue
    // prev/next controls cycling the same fixtures.
    return (
      <>
        <div className="absolute" style={{ left: 'var(--margin-x)', top: '42vh' }}>
          <SpecCard fixture={railFixture} />
          <div className="mt-3 flex items-center gap-6">
            <button
              type="button"
              onClick={() => setRailIdx((i) => (i - 1 + FIXTURES.length) % FIXTURES.length)}
              className="font-mono text-[10.5px] uppercase tracking-[.15em] text-primary"
            >
              ← Prev profile
            </button>
            <button
              type="button"
              onClick={() => setRailIdx((i) => (i + 1) % FIXTURES.length)}
              className="font-mono text-[10.5px] uppercase tracking-[.15em] text-primary"
            >
              Next profile →
            </button>
          </div>
        </div>
        <p
          aria-hidden="true"
          className="absolute font-mono text-[10.5px] uppercase tracking-[.15em] text-foreground/40"
          style={{ left: 'var(--margin-x)', top: 'calc(var(--floor-y) + 34px)' }}
        >
          SAMPLE PROFILES · REAL ONES ARRIVE AT LAUNCH
        </p>
      </>
    )
  }

  return (
    <>
      {/* the whole panel is the racket: click or Space in the hit window */}
      <div
        role="button"
        tabIndex={0}
        aria-label="Return the ball. Click or press Space while the receiver is blue."
        className="absolute inset-0 cursor-pointer"
        onPointerDown={tryReturn}
        onKeyDown={(e) => {
          if (e.key === ' ' || e.key === 'Enter') {
            e.preventDefault()
            tryReturn()
          }
        }}
      />

      {/* scoreboard */}
      <p
        aria-live="polite"
        className="absolute font-mono text-[10.5px] uppercase tracking-[.15em] text-foreground"
        style={{ right: 'var(--margin-x)', top: '12vh' }}
      >
        RALLY {String(count).padStart(2, '0')}
      </p>

      {/* the wall (platform side): lime bar standing on the floor line */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute bg-lime"
        style={{
          left: '38.5vw',
          top: 'calc(var(--floor-y) - 22vh)',
          width: '3vw',
          height: '22vh',
          borderRadius: '1.8vw 0.36vw 0.36vw 0.36vw',
        }}
      />

      {/* the net: a 1.5px ink post mid-court */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute w-[1.5px] bg-foreground"
        style={{ left: '60vw', top: 'calc(var(--floor-y) - 14vh)', height: '14vh' }}
      />
      <span
        aria-hidden="true"
        className="pointer-events-none absolute -translate-x-1/2 font-mono text-[10.5px] uppercase tracking-[.15em] text-foreground/40"
        style={{ left: '60vw', top: 'calc(var(--floor-y) + 12px)' }}
      >
        NET
      </span>

      {/* the receiver (player side): ink bar, blue while the window is open */}
      <div
        ref={receiverRef}
        aria-hidden="true"
        className="pointer-events-none absolute bg-foreground"
        style={{
          left: '85.5vw',
          top: 'calc(var(--floor-y) - 12vh)',
          width: '1vw',
          height: '12vh',
          borderRadius: '0.6vw 0.12vw 0.12vw 0.12vw',
          transition: 'background-color 120ms ease-out',
        }}
      />

      {/* the ball: 14px lime circle, 1.5px ink outline, imperative transform */}
      <div
        ref={ballRef}
        aria-hidden="true"
        className="pointer-events-none absolute left-0 top-0 h-[14px] w-[14px] rounded-full border-[1.5px] border-foreground bg-lime will-change-transform"
        style={{ transform: 'translate3d(-100px, -100px, 0)' }}
      />

      {/* profile rail: one docked card cycling on each successful return */}
      <div
        className="pointer-events-none absolute z-10"
        style={{ left: 'var(--margin-x)', top: '42vh' }}
      >
        <p className="mb-2 font-mono text-[10.5px] uppercase tracking-[.15em] text-muted-foreground">
          PROFILE {String(railIdx + 1).padStart(2, '0')} / {String(FIXTURES.length).padStart(2, '0')}
        </p>
        <SpecCard fixture={railFixture} />
      </div>

      {/* mono caption (sub-baseline), one line below the wayfinding counter */}
      <p
        aria-hidden="true"
        className="absolute font-mono text-[10.5px] uppercase tracking-[.15em] text-foreground/40"
        style={{ left: 'var(--margin-x)', top: 'calc(var(--floor-y) + 34px)' }}
      >
        CLICK OR PRESS SPACE WHEN THE RECEIVER TURNS BLUE · EACH RETURN OPENS A PROFILE
      </p>
    </>
  )
}
