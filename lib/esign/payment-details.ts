// Per-deal payment details the Athlete supplies at signing so the Sponsor can
// pay the Fee directly (Podium never touches deal money). These are captured on
// the Review & Sign step, stored on that contract's athlete signature row
// (contract_signatures.payment_details), and rendered into that contract's PDF
// only. They are sensitive personal/financial data: readable solely by the
// contract's participants via RLS, written service-role only, and scrubbed by
// erase_user_data on erasure.
//
// Validation is deliberately forgiving — bank identifiers vary across countries
// and non-bank methods (e.g. PayPal) go in `instructions` — so we trim, cap
// length, drop blanks, and never reject a shape. What survives is exactly what
// the Athlete typed.

export interface AgreementPaymentDetails {
  /** Name on the receiving account. */
  accountHolderName?: string | null
  bankName?: string | null
  accountNumber?: string | null
  sortCode?: string | null
  iban?: string | null
  swiftBic?: string | null
  /** Payment reference the Sponsor should quote. */
  reference?: string | null
  /** Free text for non-bank methods or extra guidance. */
  instructions?: string | null
}

export const PAYMENT_FIELD_MAX = 140
export const PAYMENT_INSTRUCTIONS_MAX = 500

const SHORT_FIELDS = [
  'accountHolderName',
  'bankName',
  'accountNumber',
  'sortCode',
  'iban',
  'swiftBic',
  'reference',
] as const

/**
 * Coerce arbitrary input (a request body, a stored jsonb value) into a clean
 * AgreementPaymentDetails, or null when nothing usable is present. Only known
 * string fields survive; unknown keys and non-string values are dropped.
 */
export function normalizePaymentDetails(input: unknown): AgreementPaymentDetails | null {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return null
  const src = input as Record<string, unknown>

  const clean = (value: unknown, max: number): string | null => {
    if (typeof value !== 'string') return null
    const trimmed = value.trim()
    if (!trimmed) return null
    return trimmed.slice(0, max)
  }

  const out: AgreementPaymentDetails = {}
  for (const key of SHORT_FIELDS) {
    const value = clean(src[key], PAYMENT_FIELD_MAX)
    if (value) out[key] = value
  }
  const instructions = clean(src.instructions, PAYMENT_INSTRUCTIONS_MAX)
  if (instructions) out.instructions = instructions

  return Object.keys(out).length > 0 ? out : null
}
