'use client'

import { useEffect, useRef, useState } from 'react'
import { CHIP_LEADING, CHIP_PAD, CHIP_RADIUS, CHIP_SHADOW } from './chip'

// The hero's fill-in-the-blank chip (build spec v3 §4.2): a miniature domino.
// The outgoing word tips forward about its bottom edge, the incoming one
// rises from behind, and the lime tile glides to each word's width. The cycle
// loops forever (founder direction 2026-08-10: no counter, no lock).
//
// Baseline rule (founder feedback 2026-08-12: the word still rode high and the
// tile floated above the line). An inline-block that clips its overflow aligns
// its BOTTOM EDGE to the sentence baseline, not its text, which lifted the
// whole tile a quarter of an em. So the clipping now happens one level in: an
// unclipped outer span takes its baseline from an in-flow ruler exactly as the
// static Chip does, and the tile is laid over that box, hanging below the line
// by its own padding the way a real tile would.
const WORDS = ['athletes', 'teams', 'brands', 'you'] as const
// Founder-tuned cadence (2026-08-05): quick flips, a longer beat on "you".
const CADENCE_MS = 800
const YOU_HOLD_MS = 1200

export default function WordChip() {
  const [index, setIndex] = useState(0)
  const [prev, setPrev] = useState<number | null>(null)
  const [width, setWidth] = useState<number | null>(null)
  const rulers = useRef<(HTMLSpanElement | null)[]>([])

  // Measure the current word (the ruler includes the chip's own padding). The
  // late re-measures cover web-font swaps and post-hydration layout shifts.
  useEffect(() => {
    const measure = () => {
      const el = rulers.current[index]
      if (el) setWidth(el.offsetWidth)
    }
    measure()
    const t = setTimeout(measure, 400)
    document.fonts?.ready.then(measure).catch(() => {})
    return () => clearTimeout(t)
  }, [index])

  // Cycle with per-word cadence; "you" holds longer. Loops forever.
  useEffect(() => {
    const delay = WORDS[index] === 'you' ? YOU_HOLD_MS : CADENCE_MS
    const id = setTimeout(() => {
      setPrev(index)
      setIndex((i) => (i + 1) % WORDS.length)
    }, delay)
    return () => clearTimeout(id)
  }, [index])

  return (
    <>
      <span
        aria-hidden="true"
        className="relative inline-block whitespace-nowrap align-baseline"
        style={{
          lineHeight: CHIP_LEADING,
          width: width !== null ? `${width}px` : undefined,
          transition: 'width 300ms cubic-bezier(0.22, 1, 0.36, 1)',
        }}
      >
        {/* the in-flow ruler: invisible, unclipped, and the only thing that
            decides where this whole assembly sits on the sentence's baseline */}
        <span className={`${CHIP_PAD} invisible inline-block`}>{WORDS[index]}</span>
        {/* measurement rulers: every word, so a flip never reflows the line */}
        {WORDS.map((w, i) => (
          <span
            key={w}
            ref={(el) => {
              rulers.current[i] = el
            }}
            className={`${CHIP_PAD} invisible absolute left-0 top-0 inline-block`}
          >
            {w}
          </span>
        ))}
        {/* the tile itself, laid over that box and clipping the flip */}
        <span
          className="chip-wrap absolute inset-0 overflow-hidden bg-lime text-lime-foreground"
          style={{
            borderRadius: CHIP_RADIUS,
            boxShadow: CHIP_SHADOW,
            perspective: '800px',
          }}
        >
          {prev !== null && (
            <span
              key={`out-${prev}-${index}`}
              className={`chip-out absolute inset-x-0 top-0 inline-block ${CHIP_PAD}`}
            >
              {WORDS[prev]}
            </span>
          )}
          <span
            key={`in-${index}`}
            className={`absolute inset-x-0 top-0 inline-block ${CHIP_PAD} ${prev !== null ? 'chip-in' : ''}`}
          >
            {WORDS[index]}
          </span>
        </span>
      </span>
      <span aria-hidden="true">.</span>
      <span className="sr-only">athletes, teams, brands and you</span>
    </>
  )
}
