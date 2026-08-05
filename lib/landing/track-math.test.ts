import { describe, it, expect } from 'vitest'
import { trackX, snapTarget, dominoAngle, PANEL_COUNT } from './track-math'

describe('trackX', () => {
  it('maps scroll linearly onto horizontal travel', () => {
    // 5 panels of 1000px, viewport 1000 → track 5000, travel 4000, range 4000
    expect(trackX(0, 4000, 5000, 1000)).toBe(0)
    expect(trackX(2000, 4000, 5000, 1000)).toBe(-2000)
    expect(trackX(4000, 4000, 5000, 1000)).toBe(-4000)
  })
  it('clamps beyond either end', () => {
    expect(trackX(-50, 4000, 5000, 1000)).toBe(0)
    expect(trackX(9999, 4000, 5000, 1000)).toBe(-4000)
  })
})

describe('snapTarget', () => {
  it('snaps when resting within 15% of a panel boundary', () => {
    expect(snapTarget(-1100, 1000)).toBe(-1000)
    expect(snapTarget(-1860, 1000)).toBe(-2000)
  })
  it('returns null mid-panel', () => {
    expect(snapTarget(-1500, 1000)).toBeNull()
  })
})

describe('dominoAngle', () => {
  it('all bars upright at 0 and flat at 1', () => {
    for (const i of [0, 1, 2] as const) {
      expect(dominoAngle(0, i)).toBe(0)
      expect(dominoAngle(1, i)).toBe(90)
    }
  })
  it('staggers: bar 0 finishes before bar 2 starts moving much', () => {
    expect(dominoAngle(0.45, 0)).toBe(90)
    expect(dominoAngle(0.45, 2)).toBe(0)
  })
  it('exposes the panel count', () => {
    expect(PANEL_COUNT).toBe(5)
  })
})
