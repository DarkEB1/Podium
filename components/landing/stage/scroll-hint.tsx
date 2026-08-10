'use client'

import { useEffect, useRef } from 'react'
import { useStage } from './stage'

// The invitation (founder feedback 2026-08-10: visitors did not know to
// scroll). A landing page whose whole story is told by scrolling has to ask
// for that first push out loud, so this sits under the call to action at full
// contrast with a travelling rule and a bobbing arrow, and gets out of the way
// the instant the visitor obliges.
export default function ScrollHint() {
  const stage = useStage()
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const apply = (p: number) => {
      const el = ref.current
      if (!el) return
      // Fade across the first sliver of travel rather than snapping off, so
      // acting on it feels like it was acknowledged.
      const gone = Math.min(Math.max(p / 0.02, 0), 1)
      el.style.opacity = String(1 - gone)
      el.style.transform = `translateY(${gone * 10}px)`
    }
    apply(stage.getP())
    return stage.subscribe(apply)
  }, [stage])

  return (
    <div
      ref={ref}
      className="pointer-events-none absolute flex items-center gap-3"
      style={{ left: 'var(--margin-x)', top: 'calc(var(--floor-y) - 6vh)' }}
    >
      <span className="scroll-hint-arrow font-mono text-[15px] leading-none text-foreground">↓</span>
      <span className="font-mono text-[11px] uppercase tracking-[.18em] text-foreground">
        Scroll to tip the podium
      </span>
      <span aria-hidden="true" className="scroll-hint-rule block h-px w-16 bg-foreground/30" />
    </div>
  )
}
