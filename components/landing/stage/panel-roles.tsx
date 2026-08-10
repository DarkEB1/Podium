'use client'

import Link from 'next/link'
import { panelHover } from './hover-store'

// Panel 04 · Who's on the podium (v2, 2026-08-10): the podium columns are
// 3D plastic pieces in the scene (SET_PIECES ids role-0/1/2) that grow out
// of the floor as the corridor arrives, 1st place in full lime. This layer
// draws the role copy riding on the columns and mirrors the hover lift.
const ROLES = [
  {
    id: 'role-0',
    label: 'TEAMS & CLUBS',
    place: '2ND',
    center: 42,
    w: 16,
    h: 30,
    bullets: ['List club and youth sponsorships', 'Manage many offers at once', 'Guardian consent built in'],
    cta: 'Start as a club',
  },
  {
    id: 'role-1',
    label: 'ATHLETES',
    place: '1ST',
    center: 60,
    w: 16,
    h: 38,
    bullets: ['Create a free profile', 'List sponsorship offers', 'Get paid for deals'],
    cta: 'Start as an athlete',
  },
  {
    id: 'role-2',
    label: 'BRANDS',
    place: '3RD',
    center: 78,
    w: 16,
    h: 24,
    bullets: ['Search every level of sport', 'Compare offers side by side', 'Sign and pay in one place'],
    cta: 'Start as a brand',
  },
]

export default function PanelRoles() {
  return (
    <section
      aria-labelledby="roles-heading"
      className="relative h-screen w-screen shrink-0"
      data-panel="04"
    >
      <p
        className="absolute flex items-center gap-3 font-mono text-[10.5px] uppercase tracking-[.15em] text-foreground"
        style={{ left: 'var(--margin-x)', top: '12vh' }}
      >
        <span aria-hidden="true" className="inline-block h-[3px] w-5 bg-lime" />
        04 · WHO&rsquo;S ON THE PODIUM
      </p>
      <h2
        id="roles-heading"
        className="absolute font-heading font-extrabold text-foreground"
        style={{
          left: 'var(--margin-x)',
          top: '16vh',
          fontSize: 'var(--display-l)',
          lineHeight: 0.95,
          letterSpacing: '-0.03em',
          maxWidth: '38vw',
        }}
      >
        Made for the whole podium.
      </h2>

      {ROLES.map((r) => (
        <div
          key={r.id}
          onPointerEnter={() => {
            panelHover.id = r.id
          }}
          onPointerLeave={() => {
            panelHover.id = null
          }}
          className="absolute transition-transform duration-200 ease-out hover:-translate-y-[2.2vh]"
          style={{
            left: `${r.center - r.w / 2}vw`,
            width: `${r.w}vw`,
            height: `${r.h}vh`,
            bottom: 'calc(100vh - var(--floor-y))',
          }}
        >
          <div className="absolute inset-x-[1.4vw] bottom-[2vh] text-foreground">
            <h3 className="font-mono text-[10.5px] uppercase tracking-[.15em]">{r.label}</h3>
            <ul className="mt-1.5 font-light" style={{ fontSize: 'clamp(12px,0.95vw,15px)', lineHeight: 1.55 }}>
              {r.bullets.map((b) => (
                <li key={b}>{b}</li>
              ))}
            </ul>
            <Link href="/role-select" className="mt-2 inline-block text-[clamp(12px,0.95vw,15px)] font-medium text-primary">
              {r.cta} <span aria-hidden="true">▸</span>
            </Link>
          </div>
        </div>
      ))}

      {/* floor captions: podium places */}
      {ROLES.map((r) => (
        <span
          key={r.place}
          aria-hidden="true"
          className="absolute -translate-x-1/2 font-mono text-[10.5px] uppercase tracking-[.15em] text-foreground/40"
          style={{ left: `${r.center}vw`, top: 'calc(var(--floor-y) + 12px)' }}
        >
          {r.place}
        </span>
      ))}
    </section>
  )
}
