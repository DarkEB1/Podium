'use client'

import { useEffect, useRef } from 'react'
import { useStage } from './stage'
import Chip from './chip'
import { panelHover } from './hover-store'
import { assemblyU } from './track-map'

// Panel 03 · What we do (v3, 2026-08-10): the three steps read as an assembly.
// Each part has a dashed footprint waiting on the floor; as the corridor
// arrives the 3D part (scene.tsx SET_PIECES, ids what-0/1/2) drops in, clicks
// home, and its footprint and copy hand over to the solid piece. This file
// draws the footprints, the copy riding on the plastic, and the hover zones.
const STEPS = [
  {
    id: 'what-0',
    n: '01',
    center: 20,
    w: 16,
    h: 26,
    caption: 'PROFILE',
    title: 'Build your profile',
    lines: ['Free for athletes and clubs.', 'Your sport, your story, your numbers.'],
  },
  {
    id: 'what-1',
    n: '02',
    center: 45,
    w: 16,
    h: 32,
    caption: 'OFFER',
    title: 'Set your offer',
    lines: ['Deliverables, price, season.', 'Sponsors see exactly what they get.'],
  },
  {
    id: 'what-2',
    n: '03',
    center: 70,
    w: 16,
    h: 38,
    caption: 'DEAL',
    title: 'Sign and get paid',
    lines: ['Agree and sign in one place.', 'Payments powered by Stripe.'],
  },
]

const radii = (w: number) =>
  `calc(${w}vw * 0.6) calc(${w}vw * 0.12) calc(${w}vw * 0.12) calc(${w}vw * 0.12)`

export default function PanelWhat() {
  const stage = useStage()
  const copyRefs = useRef<(HTMLDivElement | null)[]>([])
  const ghostRefs = useRef<(HTMLDivElement | null)[]>([])
  const railRef = useRef<HTMLDivElement>(null)

  // Copy fades in as its part clicks home; the footprint fades out under it.
  // Imperative writes only — this runs on every scroll frame.
  useEffect(() => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const apply = (p: number) => {
      let placed = 0
      STEPS.forEach((_, i) => {
        const u = reduce ? 1 : assemblyU(p, i)
        placed += u
        const copy = copyRefs.current[i]
        if (copy) {
          const c = Math.min(Math.max((u - 0.55) / 0.45, 0), 1)
          copy.style.opacity = String(c)
          copy.style.transform = `translateY(${(1 - c) * 8}px)`
        }
        const ghost = ghostRefs.current[i]
        if (ghost) ghost.style.opacity = String(Math.max(0, 1 - u * 1.6))
      })
      if (railRef.current) {
        railRef.current.style.transform = `scaleX(${Math.min(1, placed / STEPS.length)})`
      }
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
      <p
        className="absolute flex items-center gap-3 font-mono text-[10.5px] uppercase tracking-[.15em] text-foreground"
        style={{ left: 'var(--margin-x)', top: '12vh' }}
      >
        <span aria-hidden="true" className="inline-block h-[3px] w-5 bg-lime" />
        03 · WHAT WE DO
      </p>
      <h2
        id="what-heading"
        className="absolute font-heading font-extrabold text-foreground"
        style={{
          left: 'var(--margin-x)',
          top: '16vh',
          fontSize: 'var(--display-l)',
          lineHeight: 0.95,
          letterSpacing: '-0.03em',
        }}
      >
        <span className="block">Help you from</span>
        <span className="block">
          profile to <Chip>paid</Chip>.
        </span>
      </h2>

      {/* assembly rail: draws along the floor as parts click home */}
      <div
        aria-hidden="true"
        className="absolute h-px origin-left bg-foreground/25"
        style={{
          left: `${STEPS[0]!.center - STEPS[0]!.w / 2}vw`,
          width: `${STEPS[2]!.center + STEPS[2]!.w / 2 - (STEPS[0]!.center - STEPS[0]!.w / 2)}vw`,
          top: 'calc(var(--floor-y) - 1px)',
        }}
        ref={railRef}
      />

      {/* footprints: where each part is going to land */}
      {STEPS.map((s) => (
        <div
          key={`ghost-${s.id}`}
          aria-hidden="true"
          ref={(el) => {
            ghostRefs.current[STEPS.findIndex((x) => x.id === s.id)] = el
          }}
          className="absolute border-[1.5px] border-dashed border-foreground/30"
          style={{
            left: `${s.center - s.w / 2}vw`,
            width: `${s.w}vw`,
            height: `${s.h}vh`,
            bottom: 'calc(100vh - var(--floor-y))',
            borderRadius: radii(s.w),
          }}
        />
      ))}

      {/* copy riding on the plastic + hover zones */}
      {STEPS.map((s, i) => (
        <div
          key={s.id}
          onPointerEnter={() => {
            panelHover.id = s.id
          }}
          onPointerLeave={() => {
            panelHover.id = null
          }}
          className="group absolute transition-transform duration-200 ease-out hover:-translate-y-[2.2vh]"
          style={{
            left: `${s.center - s.w / 2}vw`,
            width: `${s.w}vw`,
            height: `${s.h}vh`,
            bottom: 'calc(100vh - var(--floor-y))',
          }}
        >
          {/* inset-0 matters: this element carries a transform, which makes it
              the containing block for the absolutely placed copy inside it */}
          <div
            className="absolute inset-0"
            ref={(el) => {
              copyRefs.current[i] = el
            }}
            style={{ opacity: 0 }}
          >
            <span className="absolute right-[1.2vw] top-[2vh] font-mono text-[10.5px] tracking-[.15em] text-foreground/50">
              PART {s.n}
            </span>
            <div className="absolute inset-x-[1.4vw] bottom-[2.2vh] text-foreground">
              <h3 className="font-heading text-[clamp(17px,1.3vw,21px)] font-medium">{s.title}</h3>
              <p
                className="mt-1.5 font-light"
                style={{ fontSize: 'clamp(13px,1vw,16px)', lineHeight: 1.5 }}
              >
                {s.lines[0]}
                <span className="block">{s.lines[1]}</span>
              </p>
            </div>
          </div>
        </div>
      ))}

      {/* floor captions */}
      {STEPS.map((s) => (
        <span
          key={s.caption}
          aria-hidden="true"
          className="absolute -translate-x-1/2 font-mono text-[10.5px] uppercase tracking-[.15em] text-foreground/40"
          style={{ left: `${s.center}vw`, top: 'calc(var(--floor-y) + 12px)' }}
        >
          {s.caption}
        </span>
      ))}
    </section>
  )
}
