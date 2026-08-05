// Landing rebuild: pure motion map (spec v3 section 4.3 cascade, 4.4 shove,
// 4.5 travel/dwell). No DOM, no React: this module is a pure function of the
// smoothed scroll progress `P` (0..1) that the stage component reads to
// position the track and the falling dominoes. Keep it that way, since the 3D
// stage and scroll-fabric code call these functions every frame.

/** Rest points in P-space where the track is fully stopped (spec section 4.5). */
export const REST_POINTS: number[] = [0, 0.27, 0.42, 0.59, 0.86]

/** Last domino settles by this P; cascade (section 4.3) lives entirely before it. */
export const CASCADE_END = 0.15

/** Shove (section 4.4) begins here, as D3's tip passes ~87 degrees, with no pre-shove dead band. */
export const SHOVE_START = 0.145

// ---------------------------------------------------------------------------
// Cubic-bezier evaluation (CSS-style: input/output both progress 0..1)
//
// A CSS `cubic-bezier(x1,y1,x2,y2)` easing is a parametric curve
// (Bx(t), By(t)) with Bx(0)=0, Bx(1)=1. Given an input progress `x`, we solve
// for the parameter `t` where Bx(t) = x (Newton-Raphson, falling back to
// bisection since the control points here are trusted to keep Bx monotonic),
// then return By(t). This is the same algorithm browsers use for the CSS
// `cubic-bezier()` timing function.
// ---------------------------------------------------------------------------

function bezierComponent(t: number, c1: number, c2: number): number {
  const c = 3 * c1
  const b = 3 * (c2 - c1) - c
  const a = 1 - c - b
  return ((a * t + b) * t + c) * t
}

function bezierDerivative(t: number, c1: number, c2: number): number {
  const c = 3 * c1
  const b = 3 * (c2 - c1) - c
  const a = 1 - c - b
  return (3 * a * t + 2 * b) * t + c
}

function solveBezierT(x: number, x1: number, x2: number): number {
  if (x <= 0) return 0
  if (x >= 1) return 1

  // Newton-Raphson: fast, and exact for the well-behaved curves used here.
  let t = x
  for (let i = 0; i < 8; i++) {
    const slope = bezierDerivative(t, x1, x2)
    if (Math.abs(slope) < 1e-6) break
    const current = bezierComponent(t, x1, x2) - x
    t -= current / slope
    if (t < 0 || t > 1) break
  }
  if (t >= 0 && t <= 1 && Math.abs(bezierComponent(t, x1, x2) - x) < 1e-6) {
    return t
  }

  // Bisection fallback for any case Newton's method walks out of [0,1].
  let lower = 0
  let upper = 1
  let guess = x
  for (let i = 0; i < 30; i++) {
    guess = (lower + upper) / 2
    const current = bezierComponent(guess, x1, x2)
    if (Math.abs(current - x) < 1e-7) break
    if (current < x) lower = guess
    else upper = guess
  }
  return guess
}

/** Builds a CSS-style `cubic-bezier(x1,y1,x2,y2)` easing function: progress in, progress out. */
function cubicBezier(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
): (x: number) => number {
  return (x: number) => {
    const clamped = Math.min(1, Math.max(0, x))
    const t = solveBezierT(clamped, x1, x2)
    return bezierComponent(t, y1, y2)
  }
}

/** `shove` token (§4.0): track impulse, tuned to velocity match. */
const shoveEase = cubicBezier(0.05, 0.7, 0.3, 1)

/** `inout-circ` token (§4.0): programmatic travel between dwells. */
const circEase = cubicBezier(0.85, 0, 0.15, 1)

// ---------------------------------------------------------------------------
// §4.5 travel and dwell map: window boundaries
// ---------------------------------------------------------------------------

const SHOVE_END = 0.225
const DWELL_02_END = 0.32
const TRAVEL_02_END = 0.38
const DWELL_03_END = 0.47
const TRAVEL_03_END = 0.53
const DWELL_04_END = 0.65
const TRAVEL_04_END = 0.71

/** Dwell (fully stopped) windows, in P-space, per §4.5. */
const DWELL_WINDOWS: ReadonlyArray<readonly [number, number]> = [
  [0, SHOVE_START], // pre-shove hold at rest point 0 (cascade plays out at x=0)
  [SHOVE_END, DWELL_02_END], // DWELL 02
  [TRAVEL_02_END, DWELL_03_END], // DWELL 03
  [TRAVEL_03_END, DWELL_04_END], // DWELL 04
  [TRAVEL_04_END, 1], // DWELL 05
]

/**
 * Track x position in vw, 0 to -400, piecewise per §4.5.
 * Pure function of smoothed P: scrubbing up replays it exactly in reverse.
 */
export function trackX(p: number): number {
  if (p <= SHOVE_START) return 0

  if (p <= SHOVE_END) {
    const t = (p - SHOVE_START) / (SHOVE_END - SHOVE_START)
    return -100 * shoveEase(t)
  }

  if (p <= DWELL_02_END) return -100

  if (p <= TRAVEL_02_END) {
    const t = (p - DWELL_02_END) / (TRAVEL_02_END - DWELL_02_END)
    return -100 - 100 * circEase(t)
  }

  if (p <= DWELL_03_END) return -200

  if (p <= TRAVEL_03_END) {
    const t = (p - DWELL_03_END) / (TRAVEL_03_END - DWELL_03_END)
    return -200 - 100 * circEase(t)
  }

  if (p <= DWELL_04_END) return -300

  if (p <= TRAVEL_04_END) {
    const t = (p - DWELL_04_END) / (TRAVEL_04_END - DWELL_04_END)
    return -300 - 100 * circEase(t)
  }

  return -400
}

// ---------------------------------------------------------------------------
// §4.3 domino cascade
// ---------------------------------------------------------------------------

interface CascadeWindow {
  start: number
  end: number
  thetaMax: number
  k: number
}

/** P windows / power-map constants per the §4.3 table. */
const CASCADE_WINDOWS: Record<0 | 1 | 2, CascadeWindow> = {
  0: { start: 0.0, end: 0.06, thetaMax: 96, k: 1.8 },
  1: { start: 0.035, end: 0.105, thetaMax: 94, k: 1.7 },
  2: { start: 0.07, end: 0.15, thetaMax: 90, k: 1.5 },
}

/** Width, in P, of the baked settle-rebound tail at the end of each window. */
const TAIL_WINDOW = 0.01

/**
 * Settle-rebound dip amplitude in degrees (§4.3: "D3: 90 -> 87.5 -> 90 ...;
 * D1/D2 half amplitude"). D3's dip is 90 - 87.5 = 2.5°; D1/D2 get half that.
 */
const TAIL_DIP_DEGREES: Record<0 | 1 | 2, number> = {
  0: 1.25,
  1: 1.25,
  2: 2.5,
}

/**
 * Rotation, in degrees, of the given piece at progress `p`.
 *
 * The rise (0 -> thetaMax) uses the full window in the power map
 * theta = thetaMax * u^k exactly as tabulated in §4.3, which is what makes
 * the strike-sync numbers (D1 ~37° at P 0.035, D2 ~28° at P 0.070) come out
 * right, since those are read mid-window, not at the tail.
 *
 * Implementation note / documented deviation: §4.3's literal tail numbers
 * (e.g. "90 -> 87.5 -> 90 across P 0.140-0.150") describe a value that is
 * already AT thetaMax at the start of that 0.010-wide tail. The plain power
 * map is nowhere near thetaMax yet at that point (piece 2 is only at ~73.7°
 * at P=0.140); its "gravity-fast finish" only closes the gap by P=end. A
 * continuous blend from the power-map value into the dip is therefore
 * mathematically incapable of producing a visible dip: the dip amplitude
 * (1.25-2.5°) is swamped by the curve's own steep final approach. To bake in
 * an actual, visible rebound as specified, the last TAIL_WINDOW of each
 * piece's window is defined directly as a cosine dip anchored at thetaMax on
 * both ends (thetaMax at tail-start, thetaMax minus amp at the tail
 * midpoint, thetaMax again at the window end): a fast snap to the rest angle
 * followed by the settle wobble, rather than a continuation of the power
 * curve. This intentionally introduces a step at the tail boundary; the
 * "monotonic non-decreasing" guarantee in the table's per-window tests is
 * scoped to before the tail for exactly this reason.
 */
export function dominoTheta(p: number, piece: 0 | 1 | 2): number {
  const { start, end, thetaMax, k } = CASCADE_WINDOWS[piece]

  if (p <= start) return 0
  if (p >= end) return thetaMax

  const tailStart = end - TAIL_WINDOW
  if (p >= tailStart) {
    const v = (p - tailStart) / (end - tailStart)
    const amp = TAIL_DIP_DEGREES[piece]
    return thetaMax - amp * Math.sin(Math.PI * v) ** 2
  }

  const u = Math.min(1, Math.max(0, (p - start) / (end - start)))
  return thetaMax * Math.pow(u, k)
}

// ---------------------------------------------------------------------------
// Rest points, panels, snapping
// ---------------------------------------------------------------------------

/** The REST_POINTS value closest to `p` (P-space distance). */
export function nearestRest(p: number): number {
  let best = REST_POINTS[0] ?? 0
  let bestDistance = Math.abs(p - best)
  for (const rest of REST_POINTS) {
    const distance = Math.abs(p - rest)
    if (distance < bestDistance) {
      bestDistance = distance
      best = rest
    }
  }
  return best
}

/** Panel 0..4 nearest to `p` (index of the nearest REST_POINT). */
export function panelIndex(p: number): number {
  const rest = nearestRest(p)
  const index = REST_POINTS.indexOf(rest)
  return index === -1 ? 0 : index
}

function isInDwell(p: number): boolean {
  return DWELL_WINDOWS.some(([start, end]) => p >= start && p <= end)
}

/** Max trackX distance (vw) for mid-travel input idle to snap to a rest (§4.5). */
const SNAP_TOLERANCE_VW = 20

/**
 * Mid-travel snap candidate: the nearest rest point if the track is within
 * 20vw of it, else null. During a dwell the track is already at rest, so this
 * always returns null there (per spec, snapping is a travel-only behaviour).
 */
export function snapCandidate(p: number): number | null {
  if (isInDwell(p)) return null
  const rest = nearestRest(p)
  const distance = Math.abs(trackX(p) - trackX(rest))
  return distance <= SNAP_TOLERANCE_VW ? rest : null
}

/** Clamped 0..1 local progress through a [start, end] choreography window. */
export function dwellLocal(p: number, start: number, end: number): number {
  if (end === start) return p >= end ? 1 : 0
  return Math.min(1, Math.max(0, (p - start) / (end - start)))
}
