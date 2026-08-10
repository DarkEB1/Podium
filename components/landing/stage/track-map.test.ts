import { describe, it, expect } from 'vitest'
import {
  REST_POINTS,
  CASCADE_END,
  ASSEMBLY_WINDOWS,
  assemblyU,
  candidateTheta,
  trackXVw,
} from './track-map'

// 16:9-ish desktop, the shape the corridor is authored against.
const VH_PER_VW = 900 / 1512

describe('corridor map', () => {
  it('parks each panel exactly on its 100vw boundary', () => {
    REST_POINTS.forEach((p, i) => {
      expect(trackXVw(p, VH_PER_VW)).toBeCloseTo(-100 * i, 4)
    })
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
    // Eased gaps mean the middle of a crossing is quicker than its ends, but
    // no stretch should be a multiple of the average.
    expect(peak / mean).toBeLessThan(2.2)
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
