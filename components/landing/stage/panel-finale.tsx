'use client'

import Link from 'next/link'
import { useEffect, useRef } from 'react'
import { useStage } from './stage'
import Chip from './chip'

// Panel 05 · Your spot (build spec v3 §3 P05). The bookend to the hero: the
// same stepped headline resolves with a static lime chip on "you", one empty
// dashed bar waits on the floor line, and the footer closes the corridor.
// The headline lines rise into place as P approaches the dwell at 0.86 —
// written imperatively through stage.subscribe refs, never per-frame setState.
const HEADLINE_LINES = ['The podium', 'has room', 'for'] as const
const RISE_START = 0.8
const RISE_STAGGER = 0.012
const RISE_SPAN = 0.036
const RISE_PX = 12

// Empty bar: D3's silhouette (7vw x 40vh) with podium-bar radii — top-left
// 60% of bar width, the rest 12% (spec §2.1).
const BAR_W_VW = 7
const BAR_H_VH = 40
// Centered in the gap the 3D podium crowd leaves open (scene.tsx SET_PIECES).
const BAR_CENTER_VW = 76

export default function PanelFinale() {
  const stage = useStage()
  const lineRefs = useRef<(HTMLSpanElement | null)[]>([])

  // Scroll beat: each line fades and rises 12px into place across a staggered
  // window inside P 0.80..0.86. Static under prefers-reduced-motion.
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const apply = (p: number) => {
      lineRefs.current.forEach((el, i) => {
        if (!el) return
        const start = RISE_START + i * RISE_STAGGER
        const u = Math.min(Math.max((p - start) / RISE_SPAN, 0), 1)
        const eased = 1 - Math.pow(1 - u, 4)
        el.style.opacity = String(eased)
        el.style.transform = `translateY(${(1 - eased) * RISE_PX}px)`
      })
    }
    apply(stage.getP())
    return stage.subscribe(apply)
  }, [stage])

  return (
    <section
      aria-labelledby="finale-heading"
      className="relative h-screen w-screen shrink-0"
      data-panel="04"
    >
      {/* kicker */}
      <p
        className="absolute flex items-center gap-3 font-mono text-[10.5px] uppercase tracking-[.15em] text-foreground"
        style={{ left: 'var(--margin-x)', top: '12vh' }}
      >
        <span aria-hidden="true" className="inline-block h-[3px] w-5 bg-lime" />
        04 · YOUR SPOT
      </p>

      {/* stepped headline: the hero sentence, resolved */}
      <h2
        id="finale-heading"
        className="absolute font-heading font-extrabold text-foreground"
        style={{
          left: 'var(--margin-x)',
          top: '16vh',
          fontSize: 'var(--display-xl)',
          lineHeight: 0.92,
          letterSpacing: '-0.035em',
        }}
      >
        {HEADLINE_LINES.map((line, i) => (
          <span
            key={line}
            ref={(el) => {
              lineRefs.current[i] = el
            }}
            className="block"
            style={i === 1 ? { marginLeft: 'var(--col)' } : undefined}
          >
            {line}
            {i === 2 && (
              <>
                {' '}
                {/* the last screen keeps the hero's lime: the sentence closes
                    where it opened */}
                <Chip tone="lime">you</Chip>.
              </>
            )}
          </span>
        ))}
      </h2>

      {/* one clear action: primary → quiet secondary → small print */}
      <div
        className="absolute flex flex-col gap-4"
        style={{ left: 'var(--margin-x)', bottom: '26vh' }}
      >
        <div className="flex items-center gap-7">
          <Link
            href="/role-select"
            className="flex h-14 items-center rounded-xl bg-primary px-8 text-[16px] font-medium text-primary-foreground transition-colors duration-150 hover:bg-[#1F35C8]"
          >
            Claim your spot
          </Link>
          <a
            href="mailto:hello@podiumsponsorship.com"
            className="text-[16px] font-medium text-primary underline-offset-4 hover:underline"
          >
            Talk to us <span aria-hidden="true">▸</span>
          </a>
        </div>
        <p className="text-[13.5px] font-light text-muted-foreground">
          Founding spots are open. Free for athletes and clubs. No card required.
        </p>
      </div>

      {/* the one empty bar in the crowd: your spot, pulsing on the floor line */}
      <div
        aria-hidden="true"
        className="absolute -translate-x-1/2 border-[1.5px] border-dashed border-foreground transition-colors duration-200 hover:border-solid hover:bg-lime/20"
        style={{
          left: `${BAR_CENTER_VW}vw`,
          top: `calc(var(--floor-y) - ${BAR_H_VH}vh)`,
          width: `${BAR_W_VW}vw`,
          height: `${BAR_H_VH}vh`,
          borderRadius: `${BAR_W_VW * 0.6}vw ${BAR_W_VW * 0.12}vw ${BAR_W_VW * 0.12}vw ${BAR_W_VW * 0.12}vw`,
          animation: 'slot-pulse 2.4s ease-in-out infinite',
        }}
      />
      <span
        aria-hidden="true"
        className="absolute -translate-x-1/2 font-mono text-[10.5px] uppercase tracking-[.15em] text-foreground/60"
        style={{ left: `${BAR_CENTER_VW}vw`, top: `calc(var(--floor-y) - ${BAR_H_VH}vh - 4.5vh)` }}
      >
        STILL OPEN
      </span>

      {/* floor caption (sub-baseline) */}
      <span
        aria-hidden="true"
        className="absolute -translate-x-1/2 font-mono text-[10.5px] uppercase tracking-[.15em] text-foreground/40"
        style={{ left: `${BAR_CENTER_VW}vw`, top: 'calc(var(--floor-y) + 12px)' }}
      >
        RESERVED FOR YOU
      </span>

      {/* footer strip: the corridor's last line, below the floor */}
      <footer
        className="absolute inset-x-0 bottom-0 flex items-center gap-8 font-mono text-[10.5px] uppercase tracking-[.15em]"
        style={{ top: '88vh', paddingInline: 'var(--margin-x)' }}
      >
        <Link
          href="/terms"
          className="text-muted-foreground transition-colors duration-150 hover:text-foreground"
        >
          TERMS
        </Link>
        <Link
          href="/privacy"
          className="text-muted-foreground transition-colors duration-150 hover:text-foreground"
        >
          PRIVACY
        </Link>
        <a
          href="mailto:hello@podiumsponsorship.com"
          className="text-muted-foreground transition-colors duration-150 hover:text-foreground"
        >
          CONTACT
        </a>
        <span className="ml-auto text-muted-foreground">© 2026 PODIUM</span>
      </footer>
    </section>
  )
}
