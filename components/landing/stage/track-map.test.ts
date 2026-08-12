import { describe, it, expect } from 'vitest'
import {
  REST_POINTS,
  CASCADE_END,
  TRAVEL_VIEWPORTS,
  ASSEMBLY_WINDOWS,
  assemblyU,
  candidateTheta,
  trackXVw,
} from './track-map'

// 16:9-ish desktop, the shape the corridor is authored against.
const VH_PER_VW = 900 / 1512
const SCROLL_PX = TRAVEL_VIEWPORTS * 900 // the whole fabric, in scroll pixels
const VW_PX = 1512 / 100
// What an ordinary trackpad flick carries. The cascade has to outlast one.
const FLICK_PX = 380

describe('corridor map', () => {
  it('parks each panel exactly on its 100vw boundary', () => {
    REST_POINTS.forEach((p, i) => {
      expect(trackXVw(p, VH_PER_VW)).toBeCloseTo(-100 * i, 4)
    })
  })

  // The complaint this guards against (founder, 2026-08-12): reaching the
  // marketplace used to cost nearly twice the scrolling of any other slide,
  // because the cascade was charged on top of the crossing instead of out of
  // it. Equal gaps are the whole point of the map, so they get a test.
  it('charges the same scrolling for every slide', () => {
    const gaps = REST_POINTS.slice(1).map((p, i) => p - REST_POINTS[i]!)
    const widest = Math.max(...gaps)
    const narrowest = Math.min(...gaps)
    expect(widest - narrowest).toBeLessThan(1e-9)
  })

  // The cascade is paid for out of the first slide, and it has to be worth a
  // real push without leaving the shove no room to finish. Both halves of that
  // are load-bearing: too short and one flick skips the dominoes, too long and
  // the screen has to lurch sideways to catch up.
  it('makes the cascade outlast a flick without eating the first slide', () => {
    const cascadePx = CASCADE_END * SCROLL_PX
    expect(cascadePx).toBeGreaterThan(FLICK_PX)
    expect(CASCADE_END / REST_POINTS[1]!).toBeLessThan(0.4)
  })

  // The complaint this answers (founder, 2026-08-12): "the animation of that
  // slide as I scroll is too fast". The corridor is geared to the hand, and
  // anything much above 1:1 reads as the page running away from the gesture
  // driving it.
  it('never moves the corridor much faster than the hand driving it', () => {
    const crossing = (100 * VW_PX) / ((REST_POINTS[2]! - REST_POINTS[1]!) * SCROLL_PX)
    expect(crossing).toBeLessThan(1.25)
  })

  it('never travels backwards as the visitor scrolls forward', () => {
    let prev = 0
    for (let p = 0; p <= 1.0001; p += 0.002) {
      const x = trackXVw(p, VH_PER_VW)
      expect(x).toBeLessThanOrEqual(prev + 1e-6)
      prev = x
    }
  })

  // The failure this guards against: the old map did all its travelling inside
  // a few narrow segments, so most of the page was dead scroll where nothing
  // moved and the rest went past in a blur.
  it('keeps moving the whole way, with no dead stretch after the cascade', () => {
    const STEP = 0.01
    let deadStretch = 0
    let worstDead = 0
    for (let p = CASCADE_END; p < 1; p += STEP) {
      const moved = Math.abs(trackXVw(p + STEP, VH_PER_VW) - trackXVw(p, VH_PER_VW))
      if (moved < 0.4) {
        deadStretch += STEP
        worstDead = Math.max(worstDead, deadStretch)
      } else {
        deadStretch = 0
      }
    }
    expect(worstDead).toBeLessThan(0.03)
  })

  it('travels at a comparable rate wherever you are', () => {
    const rates: number[] = []
    for (let p = CASCADE_END; p < 1; p += 0.01) {
      rates.push(Math.abs(trackXVw(p + 0.01, VH_PER_VW) - trackXVw(p, VH_PER_VW)))
    }
    const peak = Math.max(...rates)
    const mean = rates.reduce((a, b) => a + b, 0) / rates.length
    // Crossings run at one flat rate, so the only stretch above the average is
    // the shove out of the hero: it clears a whole viewport in what is left of
    // the first slide once the dominoes have fallen. Measured at 1.47x a
    // crossing, which reads as impact; this cap is what keeps it from becoming
    // a lurch.
    expect(peak / mean).toBeLessThan(1.5)
  })

  it('tips all three dominoes within the hand-scrubbed stretch', () => {
    expect(candidateTheta(CASCADE_END, 2)).toBeCloseTo(90, 4)
    expect(candidateTheta(0, 0)).toBe(0)
  })

  it('finishes building panel 03 before the visitor arrives at it', () => {
    const rest = REST_POINTS[2]!
    ASSEMBLY_WINDOWS.forEach((w, i) => {
      expect(w[1]).toBeLessThan(rest)
      expect(assemblyU(rest, i)).toBe(1)
    })
  })
})
