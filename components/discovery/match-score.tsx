'use client'

import * as React from 'react'
import { useReducedMotion } from 'motion/react'

import { cn } from '@/lib/utils'

interface MatchScoreProps {
  score: number
  size?: 'sm' | 'lg'
  className?: string
}

// SVG geometry: a 60x60 viewbox with a 24-radius ring, matching the approved
// score-ring.html mockup (flavor A1, "solid sweep").
const VIEWBOX = 60
const CENTER = VIEWBOX / 2
const RADIUS = 24
const STROKE_WIDTH = 5

const SIZE_PX: Record<'sm' | 'lg', number> = {
  sm: 46,
  lg: 72,
}

const NUMBER_TEXT_SIZE: Record<'sm' | 'lg', string> = {
  sm: 'text-[13px]',
  lg: 'text-[17px]',
}

/**
 * Fit-ring match score badge used on every discovery surface (feed card, card
 * back, swipe overlay). An SVG ring sweeps from empty to the score on mount,
 * like a speedometer, then settles. All colours read from theme tokens
 * (`--primary`, `--border`, `--foreground`, `--muted-foreground`) so the ring
 * holds in both light and dark without any bespoke tokens.
 */
export function MatchScore({ score, size = 'sm', className }: MatchScoreProps) {
  const clampedScore = Math.round(Math.min(100, Math.max(0, score)))
  const finalOffset = 100 - clampedScore
  const reducedMotion = useReducedMotion()

  // Starts fully empty (offset 100) so the effect below can sweep the arc in
  // on mount. Reduced-motion users get the final value immediately instead.
  const [offset, setOffset] = React.useState(reducedMotion ? finalOffset : 100)

  React.useEffect(() => {
    if (reducedMotion) {
      setOffset(finalOffset)
      return
    }
    // A frame gap between the empty first paint and the final value is what
    // gives the CSS transition below something to animate.
    const frame = requestAnimationFrame(() => setOffset(finalOffset))
    return () => cancelAnimationFrame(frame)
  }, [finalOffset, reducedMotion])

  const pixelSize = SIZE_PX[size]

  return (
    <span
      role="img"
      aria-label={`Match score ${clampedScore} out of 100`}
      className={cn('inline-flex flex-col items-center gap-1', className)}
    >
      <span
        className="relative inline-flex shrink-0 items-center justify-center"
        style={{ width: pixelSize, height: pixelSize }}
      >
        <svg
          width={pixelSize}
          height={pixelSize}
          viewBox={`0 0 ${VIEWBOX} ${VIEWBOX}`}
          aria-hidden="true"
        >
          <g transform={`rotate(-90 ${CENTER} ${CENTER})`}>
            <circle
              cx={CENTER}
              cy={CENTER}
              r={RADIUS}
              fill="none"
              className="stroke-border"
              strokeWidth={STROKE_WIDTH}
              pathLength={100}
            />
            <circle
              data-testid="match-score-arc"
              cx={CENTER}
              cy={CENTER}
              r={RADIUS}
              fill="none"
              className="stroke-primary"
              strokeWidth={STROKE_WIDTH}
              strokeLinecap="round"
              pathLength={100}
              strokeDasharray={100}
              strokeDashoffset={offset}
              style={
                reducedMotion
                  ? undefined
                  : { transition: 'stroke-dashoffset 1000ms cubic-bezier(.16,1,.3,1)' }
              }
            />
          </g>
        </svg>
        <span
          className={cn(
            'absolute inset-0 flex items-center justify-center font-mono font-semibold tabular-nums text-foreground',
            NUMBER_TEXT_SIZE[size]
          )}
        >
          {clampedScore}
        </span>
      </span>
      {size === 'lg' && (
        <span className="font-mono text-xs text-muted-foreground">match</span>
      )}
    </span>
  )
}
