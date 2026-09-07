import { describe, it, expect } from 'vitest'
import { formatDate, formatDateRange } from './dates'

describe('formatDate (DP-18)', () => {
  it('formats a date-only ISO string without a timezone shift', () => {
    // The whole point: this is stable regardless of the runner's timezone.
    expect(formatDate('2026-06-01')).toBe('1 Jun 2026')
    expect(formatDate('2026-12-31')).toBe('31 Dec 2026')
  })

  it('returns an empty string for a nullish value', () => {
    expect(formatDate(null)).toBe('')
    expect(formatDate(undefined)).toBe('')
    expect(formatDate('')).toBe('')
  })

  it('leaves a non date-only string unchanged', () => {
    expect(formatDate('2026-06-01T12:00:00Z')).toBe('2026-06-01T12:00:00Z')
  })
})

describe('formatDateRange', () => {
  it('joins a start and end', () => {
    expect(formatDateRange('2026-06-01', '2026-08-31')).toBe('1 Jun 2026 → 31 Aug 2026')
  })
  it('shows only the side that is present', () => {
    expect(formatDateRange('2026-06-01', null)).toBe('1 Jun 2026')
    expect(formatDateRange(null, '2026-08-31')).toBe('31 Aug 2026')
  })
})
