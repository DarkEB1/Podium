import { describe, expect, it } from 'vitest'
import { formatMinorAmount, formatMajorAmount } from './money'

// ST-6: Podium stores amounts in two units. payments.* and everything from
// Stripe are MINOR; proposals.pay_amount and job_listings.pay_amount are MAJOR.
// Rendering a minor-unit column raw showed a £50,000 payment as "GBP 5000000",
// and the admin revenue dashboard was inflated 100x the same way.
describe('formatMinorAmount', () => {
  it('divides by 100 and symbolises the currency', () => {
    expect(formatMinorAmount(123_400, 'GBP')).toBe('£1,234.00')
    expect(formatMinorAmount(5_000_000, 'GBP')).toBe('£50,000.00')
  })

  it('always shows two decimals', () => {
    expect(formatMinorAmount(100, 'GBP')).toBe('£1.00')
    expect(formatMinorAmount(1, 'GBP')).toBe('£0.01')
    expect(formatMinorAmount(0, 'GBP')).toBe('£0.00')
  })

  it('accepts a lowercase currency code', () => {
    expect(formatMinorAmount(2500, 'gbp')).toBe('£25.00')
  })

  // Intl renders an unsymbolisable but well-formed code itself, separating it
  // with a non-breaking space, so normalise before comparing.
  it('renders a currency Intl cannot symbolise as its code', () => {
    expect(formatMinorAmount(2500, 'ZZZ').replace(/ /g, ' ')).toBe('ZZZ 25.00')
  })

  // A malformed code makes Intl throw RangeError; the amount must still show.
  it('falls back rather than throwing on a malformed currency code', () => {
    expect(formatMinorAmount(2500, 'XX')).toBe('XX 25.00')
  })

  it('defaults to GBP for an empty currency rather than throwing', () => {
    expect(formatMinorAmount(2500, '')).toBe('£25.00')
  })
})

describe('formatMajorAmount', () => {
  it('does not divide', () => {
    expect(formatMajorAmount(5000, 'GBP')).toBe('£5,000.00')
  })
})
