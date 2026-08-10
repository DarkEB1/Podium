'use client'

import Link from 'next/link'
import { useEffect, useRef } from 'react'
import { useStage } from './stage'

// Panel 03 · What we do (build spec v3 §3, recomposed for --floor-y 80vh).
// The domino metaphor made literal as process: three podium-bar cards stand
// on the floor line in ascending height, PROFILE → OFFER → DEAL, and un-fall
// into standing one after another as the corridor arrives, exactly echoing
// the hero's load choreography. A thin arrow along the floor carries the
// cascade direction from the first card to the last.
const CARD_W = 17 // vw
const RADIUS = `${CARD_W * 0.6}vw ${CARD_W * 0.12}vw ${CARD_W * 0.12}vw ${CARD_W * 0.12}vw`
const CARDS = [
  {
    step: '01',
    caption: 'PROFILE',
    title: 'Build your profile',
    lines: ['Free for athletes and clubs.', 'Your sport, your story, your goals.'],
    left: 8,
    h: 26,
    lime: false,
  },
  {
    step: '02',
    caption: 'OFFER',
    title: 'List what sponsors get',
    lines: ['Set deliverables, price and season.', 'Brands see exactly what they get.'],
    left: 33,
    h: 32,
    lime: false,
  },
  {
    step: '03',
    caption: 'DEAL',
    title: 'Sign and get paid',
    lines: ['Agree and sign inside Podium.', 'Brands pay through the product.'],
    left: 58,
    h: 38,
    lime: true,
  },
] as const

// Un-fall scrub window: P 0.36..0.42 (the approach to this panel's dwell).
// Stagger ≈ 120ms of scroll at dwell approach speed, one card after another.
const TRIGGER_START = 0.36
const STAGGER = 0.012
const DURATION = 0.036
const TIPPED_DEG = 14

// out-quint rise with a small baked overshoot: the card swings past vertical
// by ~1° and settles, echoing the hero pieces' spring-settle rebound.
function easeOutBack(u: number): number {
  const c1 = 1.2
  const c3 = c1 + 1
  return 1 + c3 * Math.pow(u - 1, 3) + c1 * Math.pow(u - 1, 2)
}

export default function PanelWhat() {
  const stage = useStage()
  const cardRefs = useRef<(HTMLDivElement | null)[]>([])
  const lastDeg = useRef<number[]>([Number.NaN, Number.NaN, Number.NaN])

  // Scrub-driven un-fall: imperative style writes on refs, no per-frame
  // setState. Below 0.36 the cards rest tipped; past 0.42 they stand.
  // Reduced motion: never subscribe, cards keep their standing markup pose.
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const apply = (p: number) => {
      cardRefs.current.forEach((el, i) => {
        if (!el) return
        const u = Math.min(Math.max((p - (TRIGGER_START + i * STAGGER)) / DURATION, 0), 1)
        const deg = u === 1 ? 0 : TIPPED_DEG * (1 - easeOutBack(u))
        const prev = lastDeg.current[i] ?? Number.NaN
        if (Math.abs(deg - prev) < 0.01) return
        lastDeg.current[i] = deg
        el.style.transform = `rotate(${deg}deg)`
      })
    }
    apply(stage.getP())
    return stage.subscribe(apply)
  }, [stage])

  return (
    <section
      aria-labelledby="what-heading"
      className="relative h-screen w-screen shrink-0"
      data-panel="03"
      id="what-we-do"
    >
      {/* kicker */}
      <p
        className="absolute flex items-center gap-3 font-mono text-[10.5px] uppercase tracking-[.15em] text-foreground"
        style={{ left: 'var(--margin-x)', top: '12vh' }}
      >
        <span aria-hidden="true" className="inline-block h-[3px] w-5 bg-lime" />
        03 · WHAT WE DO
      </p>

      {/* headline + single blue action */}
      <div className="absolute" style={{ left: 'var(--margin-x)', top: '16vh' }}>
        <h2
          id="what-heading"
          className="font-heading font-extrabold text-foreground"
          style={{
            fontSize: 'var(--display-l)',
            lineHeight: 0.98,
            letterSpacing: '-0.02em',
          }}
        >
          From profile to paid.
        </h2>
        <Link
          href="/pricing"
          className="mt-5 inline-block text-[16px] font-medium text-primary underline-offset-4 hover:underline"
        >
          See pricing <span aria-hidden="true">▸</span>
        </Link>
      </div>

      {/* cascade arrow: a thread along the floor from card 1 to past card 3,
          passing behind the cards, arrowhead pointing the fall direction */}
      <div
        aria-hidden="true"
        className="absolute flex -translate-y-1/2 items-center gap-1"
        style={{
          left: `${CARDS[0].left + CARD_W / 2}vw`,
          width: `${CARDS[2].left + CARD_W + 2.5 - (CARDS[0].left + CARD_W / 2)}vw`,
          top: 'calc(var(--floor-y) - 9px)',
        }}
      >
        <span className="h-[1.5px] flex-1 bg-foreground" />
        <span className="font-mono text-[10px] leading-none text-foreground">▸</span>
      </div>

      {/* three podium-bar cards standing on the floor line */}
      {CARDS.map((c, i) => (
        <div
          key={c.step}
          ref={(el) => {
            cardRefs.current[i] = el
          }}
          className={`absolute flex flex-col p-6 ${
            c.lime ? 'bg-lime' : 'border-[1.5px] border-foreground bg-card'
          }`}
          style={{
            left: `${c.left}vw`,
            bottom: 'calc(100vh - var(--floor-y))',
            width: `${CARD_W}vw`,
            height: `${c.h}vh`,
            borderRadius: RADIUS,
            transformOrigin: 'bottom right',
            willChange: 'transform',
          }}
        >
          <span
            className={`self-end font-mono text-[10.5px] tracking-[.15em] ${
              c.lime ? 'text-lime-foreground' : 'text-foreground/60'
            }`}
          >
            {c.step}
          </span>
          <div className="mt-auto">
            <h3
              className={`font-heading font-medium ${
                c.lime ? 'text-lime-foreground' : 'text-card-foreground'
              }`}
              style={{ fontSize: 'var(--title-size)', lineHeight: 1.2 }}
            >
              {c.title}
            </h3>
            <p
              className={`mt-2 font-light ${
                c.lime ? 'text-lime-foreground' : 'text-muted-foreground'
              }`}
              style={{ fontSize: 'var(--body-size)' }}
            >
              {c.lines.map((l) => (
                <span key={l} className="block">
                  {l}
                </span>
              ))}
            </p>
          </div>
        </div>
      ))}

      {/* floor captions (sub-baseline) */}
      {CARDS.map((c) => (
        <span
          key={c.caption}
          aria-hidden="true"
          className="absolute -translate-x-1/2 font-mono text-[10.5px] uppercase tracking-[.15em] text-foreground/40"
          style={{
            left: `${c.left + CARD_W / 2}vw`,
            top: 'calc(var(--floor-y) + 12px)',
          }}
        >
          {c.caption}
        </span>
      ))}
    </section>
  )
}
