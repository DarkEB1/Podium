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
// EXACT thirds. The previous map reserved the cascade's scroll on top of the
// first crossing, so reaching the marketplace cost 1429px where the other two
// panels cost 817px each — nearly double, which is what made the page feel
// heavy at the start and quick later (founder diagnosis 2026-08-12: "each
// slide is a different scroll length"). Now every slide costs the same, and
// the cascade is paid for out of the first slide's budget rather than added
// to it.
export const REST_POINTS = [0, 1 / 3, 2 / 3, 1]

// How much scrolling the whole corridor costs, in viewport heights. This is
// the gearing between hand and page, and the single knob for how sensitive the
// scroll feels: the corridor is 300vw wide, so at 5 viewports a slide costs
// 1500px of scrolling to move 1512px sideways — dead level, one to one. It was
// geared at 1.20 (founder feedback 2026-08-13: "a bit too sensitive across the
// site") and, before that, 1.77 ("too fast"). Raising this makes the whole
// site less sensitive without touching the map; nothing else changes pace.
export const TRAVEL_VIEWPORTS = 5.0

/**
 * Progress at fraction u of the way from rest i to rest i + 1.
 *
 * Panel-local timings are written through this rather than as bare numbers, so
 * retiming the corridor can never again leave an animation stranded in the
 * wrong stretch of scroll.
 */
export function atSeg(i: number, u: number): number {
  const a = REST_POINTS[i] ?? 0
  const b = REST_POINTS[i + 1] ?? 1
  return a + (b - a) * u
}

// Hero pieces (build spec v3 §3 P01): centers/widths in vw, heights in vh.
export const PIECES = [
  { centerVw: 54, wVw: 6, hVh: 20 },
  { centerVw: 67, wVw: 6.5, hVh: 29 },
  { centerVw: 81.5, wVw: 7, hVh: 40 },
] as const

// Scroll windows for each piece's fall candidate (start, end, k). The curve
// drives an UNCONSTRAINED candidate angle 0..90; rigid contact in the scene
// decides where each piece actually rests.
// The falls overlap heavily: the last piece is already leaning before the
// first has landed. That is what a real run of dominoes does, and it also
// brings the moment its corner reaches the screen edge forward, leaving most
// of the first slide for the shove itself.
export const WINDOWS: readonly [number, number, number][] = [
  [0.0, 0.05, 1.8],
  [0.022, 0.082, 1.7],
  [0.04, 0.115, 1.4],
]

// The hand-scrubbed stretch, and the first slide's opening beat. Deliberately
// longer than a typical trackpad flick (~435px against ~380px), so one careless
// swipe cannot blow through the dominoes: they are the signature moment and
// they are meant to cost a real push. Kept as small a share of the first slide
// as that allows, because whatever it takes is taken from the shove, which has
// to clear a whole viewport in what is left.
export const CASCADE_END = 0.115

// Panel 03 assembly: each part drops into its footprint and clicks home.
// Shared by the 3D parts (scene.tsx) and the DOM copy riding on them
// (panel-what.tsx) so the text lands on exactly the frame the part does.
// Written as fractions of the second crossing so all three are home before the
// visitor arrives at the rest, whatever the corridor is retimed to.
export const ASSEMBLY_WINDOWS: readonly (readonly [number, number])[] = [
  [atSeg(1, 0.67), atSeg(1, 0.84)],
  [atSeg(1, 0.74), atSeg(1, 0.9)],
  [atSeg(1, 0.8), atSeg(1, 0.95)],
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

// The shove starts just before the last piece lands, not after it. The corner's
// own push decelerates to nothing as the piece goes flat (its tip travels on a
// cosine), so waiting for the landing left a dead patch where scrolling barely
// moved anything and then the shove snapped in. Overlapping the two means the
// screen picks up the momentum of the impact while the piece is still coming
// down, and the rate never dips.
const CROSS_START = CASCADE_END * 0.85

// The shove's velocity profile: rate ramps up over the first quarter and then
// holds flat, so the whole stretch is one steady speed rather than a swell.
// Peaks at 1.14x its own average.
const RAMP = 0.25
function rampedLinear(u: number): number {
  if (u <= 0) return 0
  if (u >= 1) return 1
  const norm = 1 - RAMP / 2
  return (u < RAMP ? (u * u) / (2 * RAMP) : RAMP / 2 + (u - RAMP)) / norm
}

/**
 * Corridor x offset in vw for progress p.
 *
 * Rate, not just distance, is what the hand feels. Every crossing is the same
 * width and covers the same 100vw, and the mapping inside it is LINEAR, so the
 * corridor moves at one constant rate from the moment the first domino's
 * corner bites until the page ends. The eased gaps this replaced had zero rate
 * at both ends of every crossing, which is why scrolling away from a panel felt
 * like pushing through treacle and the middle then went by in a rush.
 *
 * The one stretch that runs faster is the shove out of the hero: it has to
 * clear a whole viewport in what is left of the first slide once the dominoes
 * have fallen. That is the impact, and it is meant to be felt.
 */
export function trackXVw(p: number, vhPerVw: number): number {
  const firstRest = REST_POINTS[1]!
  if (p <= firstRest) {
    // Two things move the corridor across the first slide and they add up: the
    // corner welded to the screen edge, which moves it exactly as far as the
    // tip overshoots, and the shove that the impact sets off.
    const push = Math.max(0, lastTipVw(Math.min(p, CASCADE_END), vhPerVw) - 100)
    const pushAtEnd = Math.max(0, lastTipVw(CASCADE_END, vhPerVw) - 100)
    const u = (p - CROSS_START) / (firstRest - CROSS_START)
    return -(push + (100 - pushAtEnd) * rampedLinear(u))
  }
  for (let i = 1; i < REST_POINTS.length - 1; i++) {
    const a = REST_POINTS[i]!
    const b = REST_POINTS[i + 1]!
    if (p <= b) return -100 * i - 100 * ((p - a) / (b - a))
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
