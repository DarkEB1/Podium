'use client'

import { useStage, REST_POINTS } from './stage'

// The hero's secondary action (founder direction 2026-08-10): pressing it
// SCROLLS the page through the domino cascade to the marketplace panel, so a
// first-time visitor both sees how the page moves and learns that scrolling
// drives it. The arrow points down: scroll input is vertical.
export default function ScrollCue() {
  const stage = useStage()
  return (
    <button
      type="button"
      onClick={() => stage.jumpTo(REST_POINTS[1]!, 2400)}
      className="group flex items-center gap-2 text-[16px] font-medium text-primary"
    >
      See how it works
      <span
        aria-hidden="true"
        className="inline-block transition-transform duration-200 group-hover:translate-y-0.5"
      >
        ↓
      </span>
    </button>
  )
}
