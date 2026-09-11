import { describe, it, expect } from 'vitest'
import { normalizePaymentDetails, PAYMENT_FIELD_MAX, PAYMENT_INSTRUCTIONS_MAX } from './payment-details'

describe('normalizePaymentDetails', () => {
  it('returns null for non-object input', () => {
    expect(normalizePaymentDetails(null)).toBeNull()
    expect(normalizePaymentDetails(undefined)).toBeNull()
    expect(normalizePaymentDetails('nope')).toBeNull()
    expect(normalizePaymentDetails(42)).toBeNull()
    expect(normalizePaymentDetails([])).toBeNull()
  })

  it('returns null when every field is empty or whitespace', () => {
    expect(normalizePaymentDetails({})).toBeNull()
    expect(
      normalizePaymentDetails({ accountHolderName: '   ', accountNumber: '' })
    ).toBeNull()
  })

  it('keeps and trims the provided fields', () => {
    expect(
      normalizePaymentDetails({
        accountHolderName: '  Maya Okafor ',
        bankName: 'Barclays',
        accountNumber: '12345678',
        sortCode: '20-00-00',
      })
    ).toEqual({
      accountHolderName: 'Maya Okafor',
      bankName: 'Barclays',
      accountNumber: '12345678',
      sortCode: '20-00-00',
    })
  })

  it('drops blank fields but keeps the non-blank ones', () => {
    expect(
      normalizePaymentDetails({
        accountHolderName: 'Maya Okafor',
        bankName: '   ',
        instructions: 'Pay by bank transfer only',
      })
    ).toEqual({
      accountHolderName: 'Maya Okafor',
      instructions: 'Pay by bank transfer only',
    })
  })

  it('ignores unknown keys and non-string values', () => {
    expect(
      normalizePaymentDetails({
        accountHolderName: 'Maya Okafor',
        accountNumber: 12345678,
        malicious: 'drop table',
        nested: { a: 1 },
      })
    ).toEqual({ accountHolderName: 'Maya Okafor' })
  })

  it('caps each field length', () => {
    const long = 'x'.repeat(PAYMENT_FIELD_MAX + 50)
    const longInstructions = 'y'.repeat(PAYMENT_INSTRUCTIONS_MAX + 50)
    const result = normalizePaymentDetails({
      accountHolderName: long,
      instructions: longInstructions,
    })
    expect(result?.accountHolderName).toHaveLength(PAYMENT_FIELD_MAX)
    expect(result?.instructions).toHaveLength(PAYMENT_INSTRUCTIONS_MAX)
  })

  it('accepts the full international field set', () => {
    expect(
      normalizePaymentDetails({
        accountHolderName: 'Maya Okafor',
        iban: 'GB29 NWBK 6016 1331 9268 19',
        swiftBic: 'NWBKGB2L',
        reference: 'Podium deal 42',
      })
    ).toEqual({
      accountHolderName: 'Maya Okafor',
      iban: 'GB29 NWBK 6016 1331 9268 19',
      swiftBic: 'NWBKGB2L',
      reference: 'Podium deal 42',
    })
  })
})
