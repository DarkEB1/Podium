'use client'

import { useStage } from './stage'

// The hero's secondary action (founder direction 2026-08-10): pressing it
// nudges the scroll just far enough that the first domino starts to tip,
// then leaves the visitor to finish the push themselves. The arrow points
// sideways: that is where the page goes.
export default function ScrollCue() {
  const stage = useStage()
  return (
    <button
      type="button"
      onClick={() => stage.jumpTo(0.024, 900)}
      className="group flex items-center gap-2 text-[16px] font-medium text-primary"
    >
      See how it works
      <span
        aria-hidden="true"
        className="inline-block transition-transform duration-200 group-hover:translate-x-0.5"
      >
        →
      </span>
    </button>
  )
}
