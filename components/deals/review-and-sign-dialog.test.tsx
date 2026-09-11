import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { ReviewAndSignDialog } from './review-and-sign-dialog'

const terms = {
  title: 'Summer Deal', pay_amount: 5000, pay_currency: 'GBP', pay_type: 'flat_fee',
  timeline_start: '2026-06-01', timeline_end: '2026-08-31',
  deliverables: '3 posts', usage_rights: 'Social', additional_terms: 'None',
}

describe('ReviewAndSignDialog', () => {
  beforeEach(() => { vi.restoreAllMocks() })

  it('disables submit until a name is typed and consent is ticked', () => {
    render(<ReviewAndSignDialog open contractId="c1" terms={terms} onSigned={() => {}} onClose={() => {}} />)
    const submit = screen.getByRole('button', { name: /sign contract/i })
    expect(submit).toBeDisabled()
    fireEvent.change(screen.getByLabelText(/full name/i), { target: { value: 'Ada Buyer' } })
    fireEvent.click(screen.getByLabelText(/i agree/i))
    expect(submit).toBeEnabled()
  })

  it('POSTs typedName + consent and calls onSigned on success', async () => {
    const onSigned = vi.fn()
    const fetchMock = vi.spyOn(global, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ id: 'c1', status: 'fully_signed' }), { status: 200 })
    )
    render(<ReviewAndSignDialog open contractId="c1" terms={terms} onSigned={onSigned} onClose={() => {}} />)
    fireEvent.change(screen.getByLabelText(/full name/i), { target: { value: 'Ada Buyer' } })
    fireEvent.click(screen.getByLabelText(/i agree/i))
    fireEvent.click(screen.getByRole('button', { name: /sign contract/i }))
    await waitFor(() => expect(onSigned).toHaveBeenCalled())
    const [, init] = fetchMock.mock.calls[0]!
    expect(JSON.parse(String(init?.body))).toMatchObject({ typedName: 'Ada Buyer', consent: true })
  })

  it('shows payment-detail fields only when collecting payee details', () => {
    const { rerender } = render(
      <ReviewAndSignDialog open contractId="c1" terms={terms} onSigned={() => {}} onClose={() => {}} />
    )
    expect(screen.queryByLabelText(/account holder/i)).toBeNull()

    rerender(
      <ReviewAndSignDialog open contractId="c1" terms={terms} collectPayeeDetails onSigned={() => {}} onClose={() => {}} />
    )
    expect(screen.getByLabelText(/account holder/i)).toBeTruthy()
    expect(screen.getByLabelText(/account number/i)).toBeTruthy()
    expect(screen.getByLabelText(/sort code/i)).toBeTruthy()
  })

  it('POSTs the entered payment details when collecting', async () => {
    const onSigned = vi.fn()
    const fetchMock = vi.spyOn(global, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ id: 'c1', status: 'fully_signed' }), { status: 200 })
    )
    render(
      <ReviewAndSignDialog open contractId="c1" terms={terms} collectPayeeDetails onSigned={onSigned} onClose={() => {}} />
    )
    fireEvent.change(screen.getByLabelText(/full name/i), { target: { value: 'Jordan Athlete' } })
    fireEvent.change(screen.getByLabelText(/account holder/i), { target: { value: 'Jordan Athlete' } })
    fireEvent.change(screen.getByLabelText(/account number/i), { target: { value: '12345678' } })
    fireEvent.change(screen.getByLabelText(/sort code/i), { target: { value: '20-00-00' } })
    fireEvent.click(screen.getByLabelText(/i agree/i))
    fireEvent.click(screen.getByRole('button', { name: /sign contract/i }))
    await waitFor(() => expect(onSigned).toHaveBeenCalled())
    const [, init] = fetchMock.mock.calls[0]!
    expect(JSON.parse(String(init?.body)).paymentDetails).toMatchObject({
      accountHolderName: 'Jordan Athlete',
      accountNumber: '12345678',
      sortCode: '20-00-00',
    })
  })

  it('omits paymentDetails when the fields are left blank', async () => {
    const onSigned = vi.fn()
    const fetchMock = vi.spyOn(global, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ id: 'c1', status: 'fully_signed' }), { status: 200 })
    )
    render(
      <ReviewAndSignDialog open contractId="c1" terms={terms} collectPayeeDetails onSigned={onSigned} onClose={() => {}} />
    )
    fireEvent.change(screen.getByLabelText(/full name/i), { target: { value: 'Jordan Athlete' } })
    fireEvent.click(screen.getByLabelText(/i agree/i))
    fireEvent.click(screen.getByRole('button', { name: /sign contract/i }))
    await waitFor(() => expect(onSigned).toHaveBeenCalled())
    const [, init] = fetchMock.mock.calls[0]!
    expect(JSON.parse(String(init?.body)).paymentDetails).toBeUndefined()
  })
})
