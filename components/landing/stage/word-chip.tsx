'use client'

import { useEffect, useRef, useState } from 'react'

// The hero's fill-in-the-blank chip (build spec v3 §4.2): a miniature domino.
// The outgoing word tips forward about its bottom edge, the incoming one
// rises from behind, and the lime block glides to each word's width. The
// cycle loops forever (founder direction 2026-08-10: no counter, no lock).
const WORDS = ['athletes', 'teams', 'brands', 'you'] as const
// Founder-tuned cadence (2026-08-05): quick flips, a longer beat on "you".
const CADENCE_MS = 800
const YOU_HOLD_MS = 1200

export default function WordChip() {
  const [index, setIndex] = useState(0)
  const [prev, setPrev] = useState<number | null>(null)
  const [width, setWidth] = useState<number | null>(null)
  const rulers = useRef<(HTMLSpanElement | null)[]>([])

  // Measure the current word (ruler includes the chip's own padding). The
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
        className="chip-wrap relative inline-block overflow-hidden whitespace-nowrap bg-lime align-baseline leading-[1.02] text-lime-foreground"
        style={{
          borderRadius: 'min(0.6em, 28px) 0.12em 0.12em 0.12em',
          width: width !== null ? `${width}px` : undefined,
          transition: 'width 300ms cubic-bezier(0.22, 1, 0.36, 1)',
          perspective: '800px',
        }}
      >
        {/* rulers: every word rendered invisibly so measurement never reflows */}
        {WORDS.map((w, i) => (
          <span
            key={w}
            ref={(el) => {
              rulers.current[i] = el
            }}
            className={`px-[0.18em] ${i === 0 ? 'invisible inline-block' : 'invisible absolute left-0 top-0 inline-block'}`}
          >
            {w}
          </span>
        ))}
        {prev !== null && (
          <span key={`out-${prev}-${index}`} className="chip-out absolute inset-x-0 top-0 inline-block px-[0.18em]">
            {WORDS[prev]}
          </span>
        )}
        <span key={`in-${index}`} className={`absolute inset-x-0 top-0 inline-block px-[0.18em] ${prev !== null ? 'chip-in' : ''}`}>
          {WORDS[index]}
        </span>
      </span>
      <span aria-hidden="true">.</span>
      <span className="sr-only">athletes, teams, brands and you</span>
    </>
  )
}
