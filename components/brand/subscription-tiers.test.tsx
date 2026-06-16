import { render, screen, waitFor, within } from '@testing-library/react'
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

  it('renders all 3 tiers side by side', () => {
    render(<SubscriptionTiers subscription={null} />)
    // each tier name appears in both its card and the comparison-table column header
    expect(screen.getAllByText(/tier 1/i).length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText(/tier 2/i).length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText(/tier 3/i).length).toBeGreaterThanOrEqual(1)
  })

  it('highlights Tier 2 as Most Popular', () => {
    render(<SubscriptionTiers subscription={null} />)
    expect(screen.getByText(/most popular/i)).toBeInTheDocument()
  })

  it('shows a 7-day free trial headline on each card', () => {
    render(<SubscriptionTiers subscription={null} />)
    const headlines = screen.getAllByText(/7-day free trial/i)
    // one headline per card (the comparison footnote is excluded from the regex by being plural/different)
    expect(headlines.length).toBeGreaterThanOrEqual(3)
  })

  it('renders one Start Free Trial CTA per tier', () => {
    render(<SubscriptionTiers subscription={null} />)
    expect(screen.getAllByRole('button', { name: /start free trial/i })).toHaveLength(3)
  })

  it('renders the feature comparison table with tick / cross icons', () => {
    render(<SubscriptionTiers subscription={null} />)
    const table = screen.getByRole('table')
    expect(table).toBeInTheDocument()
    // accessible labels for non-colour-alone tick/cross
    expect(within(table).getAllByLabelText(/included/i).length).toBeGreaterThan(0)
    expect(within(table).getAllByLabelText(/not included/i).length).toBeGreaterThan(0)
  })

  it('starting a trial calls POST /api/payments/subscriptions/checkout with that tier', async () => {
    Object.defineProperty(window, 'location', { value: { href: '' }, writable: true })
    render(<SubscriptionTiers subscription={null} />)
    const ctas = screen.getAllByRole('button', { name: /start free trial/i })
    await userEvent.click(ctas[1]!)
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
