import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import ContractSignButton from './contract-sign-button'

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }))

const terms = { title: 'Deal', pay_amount: 5000, pay_currency: 'GBP', pay_type: 'flat_fee' }

describe('ContractSignButton', () => {
  it('shows payment-detail capture to the athlete (payee) when signing', () => {
    render(
      <ContractSignButton
        contractId="c1"
        status="pending_athlete_signature"
        isBrand={false}
        alreadySigned={false}
        terms={terms}
      />
    )
    fireEvent.click(screen.getByRole('button', { name: /review & sign/i }))
    expect(screen.getByLabelText(/account holder/i)).toBeTruthy()
  })

  it('does NOT show payment-detail capture to the brand (payer)', () => {
    render(
      <ContractSignButton
        contractId="c1"
        status="pending_brand_signature"
        isBrand
        alreadySigned={false}
        terms={terms}
      />
    )
    fireEvent.click(screen.getByRole('button', { name: /review & sign/i }))
    expect(screen.queryByLabelText(/account holder/i)).toBeNull()
  })
})
