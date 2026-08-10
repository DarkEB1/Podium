'use client'

import Link from 'next/link'
import { useEffect, useRef } from 'react'
import { useStage } from './stage'

// Panel 04 · Who's on the podium (build spec v3 §3, DOM recomposition
// 2026-08-10): the three roles ARE the podium. Three glyph-profile columns
// stand on the floor line in podium order (athletes tallest, center, lime);
// each carries its role's facts and one blue action. On approach the columns
// rise from under the floor line, 3rd place first, the winner last.
const RISE_START = 0.53
const RISE_STAGGER = 0.012 // the 100ms stagger mapped to scrub P (per-column window offset)
const RISE_SPAN = 0.036 // each column's rise window; the last lands at P 0.59

const COLUMN_W = 16 // vw
// Brand glyph radii: top-left 60% of width, 12% minor (scene.tsx ROUND_MAJOR).
const GLYPH_RADIUS = '9.6vw 1.92vw 1.92vw 1.92vw'
// Top and left padding keep the first text line inside the 9.6vw corner arc.
const COLUMN_PAD = '3vw 1.4vw 18px 2.9vw'
// Bullets and links scale with the column so the 24vh step never overflows.
const COLUMN_TEXT = 'clamp(11px, 0.8vw, 13.5px)'

const COLUMNS = [
  {
    role: 'TEAMS & CLUBS',
    rank: '2ND',
    left: 42,
    height: 30,
    lime: false,
    phase: 1,
    bullets: [
      'List club and youth sponsorships',
      'Manage many offers at once',
      'Guardian consent built in for minors',
    ],
    cta: 'Start as a club',
  },
  {
    role: 'ATHLETES',
    rank: '1ST',
    left: 60,
    height: 38,
    lime: true,
    phase: 2,
    bullets: [
      'Create a free profile',
      'List sponsorship offers',
      'Get paid for deals',
    ],
    cta: 'Start as an athlete',
  },
  {
    role: 'BRANDS',
    rank: '3RD',
    left: 78,
    height: 24,
    lime: false,
    phase: 0,
    bullets: [
      'Search every level of sport',
      'Compare offers side by side',
      'Sign and pay in one place',
    ],
    cta: 'Start as a brand',
  },
]

export default function PanelRoles() {
  const stage = useStage()
  const cols = useRef<(HTMLDivElement | null)[]>([])
  const lastU = useRef<number[]>([-1, -1, -1])

  // Rise choreography, driven imperatively on the refs (no per-frame state).
  // Reduced motion: the podium is simply already standing.
  useEffect(() => {
    const setPose = (i: number, u: number) => {
      const el = cols.current[i]
      if (!el || lastU.current[i] === u) return
      lastU.current[i] = u
      const e = u === 1 ? 1 : 1 - Math.pow(2, -10 * u) // out-expo
      el.style.transform = `translateY(${(1 - e) * 20}vh)`
      el.style.opacity = String(e)
    }
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      COLUMNS.forEach((_, i) => setPose(i, 1))
      return
    }
    const onP = (p: number) => {
      COLUMNS.forEach((c, i) => {
        const start = RISE_START + c.phase * RISE_STAGGER
        setPose(i, Math.min(Math.max((p - start) / RISE_SPAN, 0), 1))
      })
    }
    onP(stage.getP())
    return stage.subscribe(onP)
  }, [stage])

  return (
    <section
      aria-labelledby="roles-heading"
      className="relative h-screen w-screen shrink-0"
      data-panel="04"
    >
      {/* kicker */}
      <p
        className="absolute flex items-center gap-3 font-mono text-[10.5px] uppercase tracking-[.15em] text-foreground"
        style={{ left: 'var(--margin-x)', top: '12vh' }}
      >
        <span aria-hidden="true" className="inline-block h-[3px] w-5 bg-lime" />
        04 · WHO’S ON THE PODIUM
      </p>

      {/* headline */}
      <h2
        id="roles-heading"
        className="absolute font-heading font-extrabold text-foreground"
        style={{
          left: 'var(--margin-x)',
          top: '16vh',
          fontSize: 'var(--display-l)',
          lineHeight: 0.98,
          letterSpacing: '-0.02em',
        }}
      >
        <span className="block">Made for the</span>
        <span className="block">whole podium.</span>
      </h2>

      {/* the podium: clipped at the floor line so columns rise from under it */}
      <div
        className="pointer-events-none absolute inset-x-0 top-0 overflow-hidden"
        style={{ height: 'var(--floor-y)' }}
      >
        {COLUMNS.map((c, i) => (
          <div
            key={c.role}
            ref={(el) => {
              cols.current[i] = el
            }}
            className="pointer-events-auto absolute bottom-0 will-change-transform"
            style={{
              left: `${c.left}vw`,
              width: `${COLUMN_W}vw`,
              height: `${c.height}vh`,
              transform: 'translateY(20vh)',
              opacity: 0,
            }}
          >
            <div
              className={`flex h-full w-full flex-col border-[1.5px] transition-[transform,border-color] duration-200 hover:-translate-y-1.5 hover:border-primary focus-within:-translate-y-1.5 focus-within:border-primary ${
                c.lime
                  ? 'border-transparent bg-lime text-lime-foreground'
                  : 'border-foreground bg-card text-foreground'
              }`}
              style={{ borderRadius: GLYPH_RADIUS, padding: COLUMN_PAD }}
            >
              <h3 className="font-mono text-[10.5px] uppercase tracking-[.15em]">
                {c.role}
              </h3>
              <ul
                className="mt-3 space-y-1.5 font-light"
                style={{ fontSize: COLUMN_TEXT }}
              >
                {c.bullets.map((b) => (
                  <li key={b} className={c.lime ? undefined : 'text-muted-foreground'}>
                    {b}
                  </li>
                ))}
              </ul>
              <Link
                href="/role-select"
                className="mt-auto pt-2 font-medium text-primary underline-offset-4 hover:underline"
                style={{ fontSize: COLUMN_TEXT }}
              >
                {c.cta} <span aria-hidden="true">▸</span>
              </Link>
            </div>
          </div>
        ))}
      </div>

      {/* floor captions (sub-baseline): podium places */}
      {COLUMNS.map((c) => (
        <span
          key={c.rank}
          aria-hidden="true"
          className="absolute -translate-x-1/2 font-mono text-[10.5px] uppercase tracking-[.15em] text-foreground/40"
          style={{
            left: `${c.left + COLUMN_W / 2}vw`,
            top: 'calc(var(--floor-y) + 12px)',
          }}
        >
          {c.rank}
        </span>
      ))}
    </section>
  )
}
