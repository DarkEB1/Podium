import { describe, it, expect } from 'vitest'
import {
  normaliseCurrency,
  validatePayAmount,
  validateTimeline,
  isIsoDate,
  normaliseTimeline,
  SUPPORTED_CURRENCIES,
} from './deals-validation'

describe('normaliseCurrency', () => {
  it('uppercases and accepts each supported currency', () => {
    for (const c of SUPPORTED_CURRENCIES) {
      expect(normaliseCurrency(c.toLowerCase())).toBe(c)
    }
  })

  it('trims surrounding whitespace', () => {
    expect(normaliseCurrency('  gbp ')).toBe('GBP')
  })

  it('rejects an unsupported or junk code (WS-DEAL-04)', () => {
    expect(normaliseCurrency('123')).toBeNull()
    expect(normaliseCurrency('£10')).toBeNull()
    expect(normaliseCurrency('JPY')).toBeNull()
    expect(normaliseCurrency('gb ')).toBeNull()
    expect(normaliseCurrency('')).toBeNull()
    expect(normaliseCurrency(null)).toBeNull()
  })
})

describe('validatePayAmount (DP-5)', () => {
  it('accepts sane whole and two-decimal amounts', () => {
    expect(validatePayAmount(1)).toBeNull()
    expect(validatePayAmount(5000)).toBeNull()
    expect(validatePayAmount(49.99)).toBeNull()
    expect(validatePayAmount(999_999.99)).toBeNull()
  })

  it('rejects £0.01 and other sub-minimum amounts', () => {
    expect(validatePayAmount(0.01)).not.toBeNull()
    expect(validatePayAmount(0)).not.toBeNull()
    expect(validatePayAmount(-5)).not.toBeNull()
  })

  it('rejects absurdly large amounts (1e15)', () => {
    expect(validatePayAmount(1e15)).not.toBeNull()
  })

  it('rejects more than two decimal places (12.345)', () => {
    expect(validatePayAmount(12.345)).not.toBeNull()
    expect(validatePayAmount(0.001)).not.toBeNull()
  })

  it('rejects non-finite / non-number values', () => {
    expect(validatePayAmount(NaN)).not.toBeNull()
    expect(validatePayAmount(Infinity)).not.toBeNull()
    expect(validatePayAmount('100' as unknown)).not.toBeNull()
  })
})

describe('isIsoDate', () => {
  it('accepts a real calendar date', () => {
    expect(isIsoDate('2026-06-01')).toBe(true)
  })
  it('rejects malformed or impossible dates', () => {
    expect(isIsoDate('next week')).toBe(false)
    expect(isIsoDate('2026-13-01')).toBe(false)
    expect(isIsoDate('2026-02-30')).toBe(false)
    expect(isIsoDate('2026-6-1')).toBe(false)
  })
})

describe('validateTimeline (DP-10)', () => {
  it('accepts an absent pair and empty strings', () => {
    expect(validateTimeline(undefined, undefined)).toBeNull()
    expect(validateTimeline('', '')).toBeNull()
    expect(validateTimeline('  ', null)).toBeNull()
  })

  it('accepts start <= end and same-day', () => {
    expect(validateTimeline('2026-06-01', '2026-08-31')).toBeNull()
    expect(validateTimeline('2026-06-01', '2026-06-01')).toBeNull()
  })

  it('rejects end before start', () => {
    expect(validateTimeline('2026-08-31', '2026-06-01')).not.toBeNull()
  })

  it('rejects a malformed date string', () => {
    expect(validateTimeline('not-a-date', undefined)).not.toBeNull()
    expect(validateTimeline('2026-06-01', 'soon')).not.toBeNull()
  })
})

describe('normaliseTimeline', () => {
  it('turns empty / whitespace into null and keeps real dates', () => {
    expect(normaliseTimeline('')).toBeNull()
    expect(normaliseTimeline('  ')).toBeNull()
    expect(normaliseTimeline(undefined)).toBeNull()
    expect(normaliseTimeline('2026-06-01')).toBe('2026-06-01')
  })
})
