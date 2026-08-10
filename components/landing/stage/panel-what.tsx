'use client'

import Link from 'next/link'
import { panelHover } from './hover-store'

// Panel 03 · What we do (v2, 2026-08-10): the three steps are 3D plastic
// pieces in the scene (scene.tsx SET_PIECES, ids what-0/1/2) that tip up
// into standing as the corridor arrives. This file draws the text that
// rides ON those pieces plus the hover hit zones; hovering lifts the piece
// (via the shared hover store) and this layer mirrors the lift in CSS.
const STEPS = [
  {
    id: 'what-0',
    n: '01',
    center: 20,
    w: 16,
    h: 26,
    caption: 'PROFILE',
    title: 'Build your profile',
    lines: ['Free for athletes and clubs.', 'Your sport, your story, your goals.'],
  },
  {
    id: 'what-1',
    n: '02',
    center: 45,
    w: 16,
    h: 32,
    caption: 'OFFER',
    title: 'List what sponsors get',
    lines: ['Set deliverables, price and season.', 'Brands see exactly what they get.'],
  },
  {
    id: 'what-2',
    n: '03',
    center: 70,
    w: 16,
    h: 38,
    caption: 'DEAL',
    title: 'Sign and get paid',
    lines: ['Agree and sign inside Podium.', 'Brands pay through the product.'],
  },
]

export default function PanelWhat() {
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
        From profile to paid.
      </h2>
      <Link
        href="/pricing"
        className="absolute text-[16px] font-medium text-primary"
        style={{ left: 'var(--margin-x)', top: 'calc(16vh + var(--display-l) * 1.4)' }}
      >
        See pricing <span aria-hidden="true">▸</span>
      </Link>

      {/* text riding on the 3D steps + hover hit zones */}
      {STEPS.map((s) => (
        <div
          key={s.id}
          onPointerEnter={() => {
            panelHover.id = s.id
          }}
          onPointerLeave={() => {
            panelHover.id = null
          }}
          className="absolute transition-transform duration-200 ease-out hover:-translate-y-[2.2vh]"
          style={{
            left: `${s.center - s.w / 2}vw`,
            width: `${s.w}vw`,
            height: `${s.h}vh`,
            bottom: 'calc(100vh - var(--floor-y))',
          }}
        >
          <span className="absolute right-[1.2vw] top-[2vh] font-mono text-[10.5px] tracking-[.15em] text-foreground/50">
            {s.n}
          </span>
          <div className="absolute inset-x-[1.4vw] bottom-[2.2vh] text-foreground">
            <h3 className="font-heading text-[clamp(17px,1.3vw,21px)] font-medium">{s.title}</h3>
            <p className="mt-1.5 font-light" style={{ fontSize: 'clamp(13px,1vw,16px)', lineHeight: 1.5 }}>
              {s.lines[0]}
              <span className="block">{s.lines[1]}</span>
            </p>
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
