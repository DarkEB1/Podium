/**
 * Money formatting, in one place (ST-6).
 *
 * Podium stores amounts in TWO different units and mixing them up has already
 * caused a 100x undercharge:
 *
 *   MAJOR units — `proposals.pay_amount`, `job_listings.pay_amount`. What a
 *     human typed. The deal and listing surfaces render these directly.
 *   MINOR units — `payments.amount`, `payments.stripe_fee`, `net_amount`, and
 *     everything Stripe returns. Convert on the way in with `toMinorUnits`
 *     from lib/stripe.
 *
 * Anything reading a MINOR-unit column for display must go through
 * `formatMinorAmount`, so the division exists exactly once.
 */

function format(major: number, currency: string): string {
  const code = (currency || 'GBP').toUpperCase()
  try {
    return new Intl.NumberFormat('en-GB', { style: 'currency', currency: code }).format(major)
  } catch {
    // Intl throws on a code it cannot symbolise; still show a sane figure.
    return `${code} ${major.toFixed(2)}`
  }
}

/**
 * Format a minor-unit amount plus an ISO currency code: `(123400, 'GBP')`
 * becomes `£1,234.00`. Assumes a two-decimal currency, which every currency
 * Podium bills in is.
 */
export function formatMinorAmount(amountMinor: number, currency: string): string {
  return format(amountMinor / 100, currency)
}

/** Format an amount already in major units, e.g. `proposals.pay_amount`. */
export function formatMajorAmount(amountMajor: number, currency: string): string {
  return format(amountMajor, currency)
}
