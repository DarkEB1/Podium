import { describe, it, expect, afterEach, vi } from 'vitest'
import {
  MOTION,
  transitionClasses,
  prefersReducedMotion,
  type TransitionVariant,
} from './transitions'

afterEach(() => {
  vi.unstubAllGlobals()
})

function stubMatchMedia(reduced: boolean) {
  vi.stubGlobal(
    'matchMedia',
    vi.fn().mockImplementation((query: string) => ({
      matches: reduced && query.includes('reduce'),
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  )
}

describe('MOTION tokens', () => {
  it('defines the durations from §1.3', () => {
    expect(MOTION.duration.crossFade).toBe(200)
    expect(MOTION.duration.detail).toBe(200)
    expect(MOTION.duration.overlay).toBe(180)
  })

  it('uses an 8px upward offset for detail entry', () => {
    expect(MOTION.detailOffsetPx).toBe(8)
  })

  it('uses a 0.96 starting scale for overlays', () => {
    expect(MOTION.overlayScale).toBe(0.96)
  })
})

describe('prefersReducedMotion', () => {
  it('returns false when matchMedia is unavailable (SSR)', () => {
    vi.stubGlobal('matchMedia', undefined)
    expect(prefersReducedMotion()).toBe(false)
  })

  it('reflects the prefers-reduced-motion media query', () => {
    stubMatchMedia(true)
    expect(prefersReducedMotion()).toBe(true)
    stubMatchMedia(false)
    expect(prefersReducedMotion()).toBe(false)
  })
})

describe('transitionClasses', () => {
  const variants: TransitionVariant[] = [
    'top-level',
    'detail',
    'overlay',
    'toast',
  ]

  it('returns a class string for every variant', () => {
    for (const v of variants) {
      expect(transitionClasses(v)).toBeTruthy()
      expect(typeof transitionClasses(v)).toBe('string')
    }
  })

  it('applies motion (translate/scale) when motion is allowed', () => {
    expect(transitionClasses('detail', false)).toMatch(/translate/)
    expect(transitionClasses('overlay', false)).toMatch(/scale/)
    expect(transitionClasses('toast', false)).toMatch(/translate/)
  })

  it('collapses to opacity-only when reduced motion is requested', () => {
    for (const v of variants) {
      const reduced = transitionClasses(v, true)
      expect(reduced).toMatch(/opacity/)
      expect(reduced).not.toMatch(/translate/)
      expect(reduced).not.toMatch(/scale/)
    }
  })
})
