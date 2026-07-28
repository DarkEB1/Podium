import { describe, it, expect } from 'vitest'
import { accountStatus } from './connect'

describe('accountStatus', () => {
  it('maps a fully onboarded account', () => {
    expect(accountStatus({ charges_enabled: true, payouts_enabled: true, details_submitted: true })).toEqual({
      chargesEnabled: true,
      payoutsEnabled: true,
      detailsSubmitted: true,
    })
  })

  it('maps a not-yet-onboarded account, coercing undefined to false', () => {
    expect(
      accountStatus({ charges_enabled: null as unknown as boolean, payouts_enabled: false, details_submitted: false })
    ).toEqual({ chargesEnabled: false, payoutsEnabled: false, detailsSubmitted: false })
  })
})
