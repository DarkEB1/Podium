'use client'

import Link from 'next/link'
import PodiumMark from '@/components/brand/podium-mark'
import { REST_POINTS } from './track-map'

// Fixed 72px nav (build spec v3 §2.3). Transparent over the hero, solid page
// white with a hairline after 40px of scroll. Never translucent, never blurred.
const SECTIONS: { label: string; p: number }[] = [
  { label: 'Marketplace', p: REST_POINTS[1]! },
  { label: 'How it works', p: REST_POINTS[2]! },
]

export default function StageNav({
  solid,
  activePanel,
  onNavigate,
}: {
  solid: boolean
  activePanel: number
  onNavigate: (p: number) => void
}) {
  return (
    <header
      className={`absolute inset-x-0 top-0 z-30 flex h-[72px] items-center transition-colors duration-200 ${
        solid ? 'border-b border-foreground/8 bg-background' : 'bg-transparent'
      }`}
      style={{ paddingLeft: 'var(--margin-x)', paddingRight: 'var(--margin-x)' }}
    >
      <button
        type="button"
        onClick={() => onNavigate(0)}
        aria-label="Podium, back to start"
        className="flex items-center gap-3 text-foreground"
      >
        <PodiumMark height={28} limeTop className="text-foreground" />
        <span className="font-heading text-[18px] font-extrabold tracking-tight">Podium</span>
      </button>
      <span className="flex-1" />
      <div className="flex items-center gap-8">
        {SECTIONS.map((s, i) => (
          <button
            key={s.label}
            type="button"
            onClick={() => onNavigate(s.p)}
            className="relative hidden text-[14px] font-medium text-muted-foreground transition-colors duration-150 hover:text-foreground lg:block"
          >
            {activePanel === i + 1 && (
              <span
                aria-hidden="true"
                className="absolute -left-3 top-1/2 h-1 w-1 -translate-y-1/2 bg-lime"
              />
            )}
            {s.label}
          </button>
        ))}
        <Link
          href="/pricing"
          className="hidden text-[14px] font-medium text-muted-foreground transition-colors duration-150 hover:text-foreground lg:block"
        >
          Pricing
        </Link>
        <Link
          href="/auth"
          className="text-[14px] font-medium text-muted-foreground transition-colors duration-150 hover:text-foreground"
        >
          Sign in
        </Link>
        <Link
          href="/role-select"
          className="flex h-10 items-center rounded-xl bg-primary px-5 text-[14px] font-medium text-primary-foreground transition-colors duration-150 hover:bg-[#1F35C8]"
        >
          Join free
        </Link>
      </div>
    </header>
  )
}
