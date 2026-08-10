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
//
// Evenly spaced after the intro, and the last one is the end of the page, so
// there is no dead scroll anywhere: every panel costs the same effort to reach
// and the page finishes exactly when the corridor does.
// The cascade owns 0..0.20; the three panel crossings split the rest evenly at
// ~0.267 each, so every crossing costs the same scrolling. Unequal gaps were
// what made the shove into panel 02 feel like a lurch next to the others.
export const REST_POINTS = [0, 0.467, 0.733, 1]

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
  [0.0, 0.08, 1.8],
  [0.047, 0.14, 1.7],
  [0.093, 0.2, 1.5],
]

// The hand-scrubbed stretch. Long enough that one flick does not skip the
// whole cascade: the dominoes are the signature moment, so tipping them is
// meant to take a deliberate push (~600px at the fabric length below).
export const CASCADE_END = 0.2

// Panel 03 assembly: each part drops into its footprint and clicks home.
// Shared by the 3D parts (scene.tsx) and the DOM copy riding on them
// (panel-what.tsx) so the text lands on exactly the frame the part does.
// All three are home by 0.72, before this panel's 0.733 rest, so the visitor
// never arrives to a half-built set.
export const ASSEMBLY_WINDOWS: readonly (readonly [number, number])[] = [
  [0.645, 0.69],
  [0.663, 0.706],
  [0.68, 0.72],
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

function smooth(u: number): number {
  return u * u * (3 - 2 * u)
}

/**
 * Corridor x offset in vw for progress p.
 *
 * Every stretch of scroll moves the corridor. The old map spent most of each
 * gap parked between narrow travel segments, so scrolling felt heavy where
 * nothing moved and then far too quick when a segment finally fired. Here the
 * rests are evenly spaced and each gap is interpolated across its whole width,
 * which makes the rate of travel the same wherever the visitor is.
 */
export function trackXVw(p: number, vhPerVw: number): number {
  // The last domino's corner shoves the screen once it crosses the right edge.
  if (p <= CASCADE_END) return -Math.max(0, lastTipVw(p, vhPerVw) - 100)

  const firstRest = REST_POINTS[1]!
  if (p <= firstRest) {
    // Carry on from wherever the corner left the corridor into panel 02.
    const pushAtEnd = Math.max(0, lastTipVw(CASCADE_END, vhPerVw) - 100)
    const u = (p - CASCADE_END) / (firstRest - CASCADE_END)
    return -pushAtEnd + (-100 + pushAtEnd) * smooth(u)
  }
  for (let i = 1; i < REST_POINTS.length - 1; i++) {
    const a = REST_POINTS[i]!
    const b = REST_POINTS[i + 1]!
    if (p <= b) return -100 * i - 100 * smooth((p - a) / (b - a))
  }
  return -100 * (REST_POINTS.length - 1)
}

export function panelIndex(p: number): number {
  let best = 0
  REST_POINTS.forEach((r, i) => {
    if (Math.abs(p - r) < Math.abs(p - REST_POINTS[best]!)) best = i
  })
  return best
}
