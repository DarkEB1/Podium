// Pure geometry for the horizontal landing track. The client component feeds
// live numbers in; everything testable lives here.
export const PANEL_COUNT = 5

export function trackX(
  scrollY: number,
  scrollRange: number,
  trackWidth: number,
  viewportWidth: number
): number {
  const maxTravel = trackWidth - viewportWidth
  const progress = scrollRange <= 0 ? 0 : Math.min(Math.max(scrollY / scrollRange, 0), 1)
  const result = -progress * maxTravel
  return result === 0 ? 0 : result
}

export function snapTarget(x: number, viewportWidth: number, threshold = 0.15): number | null {
  const nearest = Math.round(x / viewportWidth) * viewportWidth
  return Math.abs(x - nearest) <= viewportWidth * threshold ? nearest : null
}

// Staged domino windows: [start, end] of the transition progress in which each
// bar rotates from 0° to 90° about its bottom-right corner (tallest last).
const WINDOWS: [number, number][] = [
  [0, 0.4],
  [0.2, 0.7],
  [0.45, 1],
]

export function dominoAngle(progress: number, barIndex: 0 | 1 | 2): number {
  const [start, end] = WINDOWS[barIndex]!
  const local = (progress - start) / (end - start)
  return 90 * Math.min(Math.max(local, 0), 1)
}
