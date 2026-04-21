import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import SubscriptionTiers from './subscription-tiers'

describe('SubscriptionTiers', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ url: 'https://checkout.stripe.com/test' }),
    }))
  })

  it('renders all 3 tiers', () => {
    render(<SubscriptionTiers subscription={null} />)
    expect(screen.getByText(/tier 1/i)).toBeInTheDocument()
    expect(screen.getByText(/tier 2/i)).toBeInTheDocument()
    expect(screen.getByText(/tier 3/i)).toBeInTheDocument()
  })

  it('subscribe button is disabled until a tier is selected', () => {
    render(<SubscriptionTiers subscription={null} />)
    expect(screen.getByRole('button', { name: /subscribe/i })).toBeDisabled()
  })

  it('subscribe button enables after selecting a tier', async () => {
    render(<SubscriptionTiers subscription={null} />)
    const tierButtons = screen.getAllByRole('button', { name: /tier/i })
    await userEvent.click(tierButtons[0]!)
    expect(screen.getByRole('button', { name: /subscribe/i })).not.toBeDisabled()
  })

  it('calls POST /api/payments/subscriptions/checkout with selected tier', async () => {
    Object.defineProperty(window, 'location', { value: { href: '' }, writable: true })
    render(<SubscriptionTiers subscription={null} />)
    const tierButtons = screen.getAllByRole('button', { name: /tier/i })
    await userEvent.click(tierButtons[1]!)
    await userEvent.click(screen.getByRole('button', { name: /subscribe/i }))
    await waitFor(() =>
      expect(fetch).toHaveBeenCalledWith(
        '/api/payments/subscriptions/checkout',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ tier: 2 }),
        })
      )
    )
  })

  it('shows current subscription when already subscribed', () => {
    const sub = { id: '1', tier: 2, status: 'active' as const, stripe_subscription_id: 'sub_123', stripe_customer_id: 'cus_123', brand_id: 'b1', current_period_start: '', current_period_end: '', created_at: '', updated_at: '', canceled_at: null, cancellation_scheduled_at: null, trial_ends_at: null }
    render(<SubscriptionTiers subscription={sub} />)
    expect(screen.getByText(/current plan/i)).toBeInTheDocument()
    expect(screen.getByText(/tier 2/i)).toBeInTheDocument()
  })
})
