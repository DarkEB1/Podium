// Shared motion map for the landing corridor. One source of truth for the DOM
// track (stage.tsx) and the 3D camera (scene.tsx) so the last domino's tip and
// the screen edge agree to the pixel.
//
// The intro contract (founder direction 2026-08-10): the corridor does not
// move until the LAST domino's top corner reaches the right viewport edge.
// From that moment the corner is the thing pushing the screen: track x equals
// -(tip overshoot). The tip's horizontal speed is zero exactly at flat (its
// motion is cosine there), so the hand-off into the panel shove is C1 smooth
// without explicit velocity matching.

// Four panels since the roles panel was cut on founder review (2026-08-10):
// hero, marketplace, what we do, your spot.
export const REST_POINTS = [0, 0.27, 0.52, 0.86]

// Hero pieces (build spec v3 §3 P01): centers/widths in vw, heights in vh.
export const PIECES = [
  { centerVw: 54, wVw: 6, hVh: 20 },
  { centerVw: 67, wVw: 6.5, hVh: 29 },
  { centerVw: 81.5, wVw: 7, hVh: 40 },
] as const

// Scroll windows for each piece's fall candidate (start, end, k). The curve
// drives an UNCONSTRAINED candidate angle 0..90; rigid contact in the scene
// decides where each piece actually rests.
export const WINDOWS: readonly [number, number, number][] = [
  [0.0, 0.06, 1.8],
  [0.035, 0.105, 1.7],
  [0.07, 0.15, 1.5],
]

export const CASCADE_END = 0.15
export const SHOVE_END = 0.225

// Panel 03 assembly: each part drops into its footprint and clicks home.
// Shared by the 3D parts (scene.tsx) and the DOM copy riding on them
// (panel-what.tsx) so the text lands on exactly the frame the part does.
// All three are home by 0.502, comfortably before this panel's 0.52 rest, so
// the visitor never arrives to a half-built set.
export const ASSEMBLY_WINDOWS: readonly (readonly [number, number])[] = [
  [0.436, 0.472],
  [0.452, 0.487],
  [0.467, 0.502],
]

/** 0..1 placement progress of assembly part i at progress p. */
export function assemblyU(p: number, i: number): number {
  const w = ASSEMBLY_WINDOWS[i]
  if (!w) return 0
  return Math.min(Math.max((p - w[0]) / (w[1] - w[0]), 0), 1)
}

/** Candidate fall angle for piece i in degrees (0 standing, 90 flat). */
export function candidateTheta(p: number, i: 0 | 1 | 2): number {
  const [s, e, k] = WINDOWS[i]!
  const u = Math.min(Math.max((p - s) / (e - s), 0), 1)
  return 90 * Math.pow(u, k)
}

const LAST = PIECES[2]
const LAST_PIVOT_VW = LAST.centerVw + LAST.wVw / 2 // 85

/** The last piece's tip x in vw. vhPerVw = viewportHeight / viewportWidth. */
export function lastTipVw(p: number, vhPerVw: number): number {
  const theta = candidateTheta(p, 2)
  return LAST_PIVOT_VW + LAST.hVh * vhPerVw * Math.sin((theta * Math.PI) / 180)
}

const SEGMENTS: [number, number, number, number][] = [
  [0.34, 0.43, -100, -200],
  [0.62, 0.72, -200, -300],
]

function smooth(u: number): number {
  return u * u * (3 - 2 * u)
}

/** Corridor x offset in vw for progress p. */
export function trackXVw(p: number, vhPerVw: number): number {
  // Push zone: the corner shoves the screen once it crosses the right edge.
  const pushAtEnd = Math.max(0, lastTipVw(CASCADE_END, vhPerVw) - 100)
  if (p <= CASCADE_END) return -Math.max(0, lastTipVw(p, vhPerVw) - 100)
  // Shove: continue from wherever the push left off into panel 02.
  if (p <= SHOVE_END) {
    const u = (p - CASCADE_END) / (SHOVE_END - CASCADE_END)
    return -pushAtEnd + (-100 + pushAtEnd) * smooth(u)
  }
  let x = -100
  for (const [s, e, from, to] of SEGMENTS) {
    if (p >= e) x = to
    else if (p > s) x = from + (to - from) * smooth((p - s) / (e - s))
  }
  return x
}

export function panelIndex(p: number): number {
  let best = 0
  REST_POINTS.forEach((r, i) => {
    if (Math.abs(p - r) < Math.abs(p - REST_POINTS[best]!)) best = i
  })
  return best
}
