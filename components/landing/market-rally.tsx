'use client'

import { useEffect, useRef, useState } from 'react'
import { RALLY_PAIRS } from '@/lib/landing/market-fixtures'
import {
  newRally,
  registerReturn,
  nextRally,
  tickerLine,
  type RallyState,
} from '@/lib/landing/rally-engine'

// Marketplace variant B: the two-sided market as a playable rally. The visitor
// returns the ball; every return escalates the deal ticker until SIGNED.
// Content (cards + ticker) is plain DOM text; the ball is decoration.

function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    setReduced(mq.matches)
    const onChange = () => setReduced(mq.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])
  return reduced
}

function PairCard({ title, subtitle, side }: { title: string; subtitle: string; side: 'left' | 'right' }) {
  return (
    <div
      className={`w-40 rounded-xl border-[1.5px] bg-card p-3 ${
        side === 'left' ? 'border-foreground' : 'border-primary'
      }`}
    >
      <span className="block font-heading text-medium font-extrabold text-foreground">{title}</span>
      <span className="mt-1 block font-mono text-small uppercase tracking-[.15em] text-muted-foreground">
        {subtitle}
      </span>
    </div>
  )
}

export default function MarketRally() {
  const reduced = useReducedMotion()
  const [state, setState] = useState<RallyState>(() => newRally(0))
  const [ballT, setBallT] = useState(0) // 0..1 position along the arc, athlete→brand
  const raf = useRef<number | null>(null)
  const dir = useRef(1)

  // Decorative ball flight: bounce t between 0 and 1. Each completed
  // athlete-side contact is triggered by the player (click / pointer hit).
  useEffect(() => {
    if (reduced) return
    const step = () => {
      setBallT((t) => {
        let next = t + dir.current * 0.012
        if (next >= 1) { next = 1; dir.current = -1 }
        if (next <= 0) { next = 0; dir.current = 1 }
        return next
      })
      raf.current = requestAnimationFrame(step)
    }
    raf.current = requestAnimationFrame(step)
    return () => { if (raf.current) cancelAnimationFrame(raf.current) }
  }, [reduced])

  const pair = RALLY_PAIRS[state.pairIndex]!
  const ticker = tickerLine(state, RALLY_PAIRS)

  const onReturn = () => {
    setState((s) => (s.signed ? nextRally(s, RALLY_PAIRS.length) : registerReturn(s)))
    dir.current = 1
  }

  const cards = (
    <div className="flex items-end justify-between gap-6">
      <PairCard title={pair.athlete.name} subtitle={`${pair.athlete.sport} · ${pair.athlete.tier}`} side="left" />
      <PairCard title={pair.brand} subtitle={`BRAND · ${pair.category}`} side="right" />
    </div>
  )

  if (reduced) {
    // Static three-frame storyboard with the same deal copy — same information,
    // zero motion (spec: fallbacks).
    const frames = [newRally(state.pairIndex), { ...state, returns: 2, signed: false }, { ...newRally(state.pairIndex), returns: 5, signed: true }]
    return (
      <div data-testid="rally-storyboard">
        {cards}
        <ol className="mt-4 space-y-1">
          {frames.map((f, i) => (
            <li key={i} className="font-mono text-small uppercase tracking-[.15em] text-muted-foreground">
              {tickerLine(f, RALLY_PAIRS)}
            </li>
          ))}
        </ol>
      </div>
    )
  }

  return (
    <div>
      <button
        type="button"
        data-testid="rally-court"
        onClick={onReturn}
        aria-label={`Tennis rally game. ${ticker}. Click or tap to return the ball.`}
        className="relative block w-full cursor-pointer border-0 bg-transparent p-0 text-left"
      >
        {cards}
        {/* ball on a dashed arc over the baseline */}
        <span
          aria-hidden="true"
          className="pointer-events-none absolute h-4 w-4 rounded-full border-2 border-foreground bg-lime"
          style={{
            left: `calc(${10 + ballT * 80}% - 8px)`,
            bottom: `${30 + Math.sin(ballT * Math.PI) * 55}%`,
          }}
        />
      </button>
      <p aria-live="polite" className="mt-4 font-mono text-small uppercase tracking-[.15em] text-muted-foreground">
        {ticker}
      </p>
    </div>
  )
}
