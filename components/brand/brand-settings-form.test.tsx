import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import BrandSettingsForm from './brand-settings-form'

describe('BrandSettingsForm', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ id: '1', company_name: 'Acme', status: 'active' }),
    }))
  })

  const baseProfile = {
    id: '1',
    company_name: 'Acme Corp',
    trading_name: '',
    headquarters_city: 'London',
    headquarters_country: 'UK',
    website_url: '',
    linkedin_url: '',
    description: '',
    status: 'active',
  } as never

  it('renders company name field pre-filled', () => {
    render(<BrandSettingsForm profile={baseProfile} />)
    expect(screen.getByDisplayValue('Acme Corp')).toBeInTheDocument()
  })

  it('shows validation error when company_name is cleared', async () => {
    render(<BrandSettingsForm profile={baseProfile} />)
    await userEvent.clear(screen.getByLabelText(/company name/i))
    await userEvent.click(screen.getByRole('button', { name: /save/i }))
    expect(await screen.findByText(/company name is required/i)).toBeInTheDocument()
  })

  it('calls PATCH /api/profiles/me on submit', async () => {
    render(<BrandSettingsForm profile={baseProfile} />)
    await userEvent.click(screen.getByRole('button', { name: /save settings/i }))
    await waitFor(() =>
      expect(fetch).toHaveBeenCalledWith('/api/profiles/me', expect.objectContaining({ method: 'PATCH' }))
    )
  })

  const subscription = {
    tier: 1,
    status: 'active' as const,
    seats_total: 5,
    seats_used: 2,
    current_period_end: '2026-07-16T00:00:00.000Z',
  }

  it('renders campaign performance summary stats', () => {
    render(
      <BrandSettingsForm
        profile={baseProfile}
        stats={{ listings: 4, matches: 12, proposals: 7, deals: 3 }}
      />,
    )
    expect(screen.getByText(/active listings/i)).toBeInTheDocument()
    expect(screen.getByText('12')).toBeInTheDocument()
  })

  it('shows a persistent failed-payment banner with Update Payment Method CTA when past_due', () => {
    render(
      <BrandSettingsForm
        profile={baseProfile}
        subscription={{ ...subscription, status: 'past_due' } as never}
      />,
    )
    expect(screen.getByRole('alert')).toHaveTextContent(/payment/i)
    expect(screen.getByRole('link', { name: /update payment method/i })).toBeInTheDocument()
  })

  it('does not show the failed-payment banner when active', () => {
    render(<BrandSettingsForm profile={baseProfile} subscription={subscription} />)
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('shows seat usage and a remove control', () => {
    render(<BrandSettingsForm profile={baseProfile} subscription={subscription} />)
    expect(screen.getByText(/2.*of.*5|2\s*\/\s*5/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /remove/i })).toBeInTheDocument()
  })

  it('confirms before removing a seat', async () => {
    render(<BrandSettingsForm profile={baseProfile} subscription={subscription} />)
    await userEvent.click(screen.getByRole('button', { name: /remove seat/i }))
    expect(fetch).not.toHaveBeenCalledWith('/api/brand/seats', expect.anything())
    await userEvent.click(screen.getByRole('button', { name: /confirm remove/i }))
    await waitFor(() =>
      expect(fetch).toHaveBeenCalledWith('/api/brand/seats', expect.objectContaining({ method: 'DELETE' })),
    )
  })

  it('renders billing history with downloadable PDF invoice links', () => {
    render(
      <BrandSettingsForm
        profile={baseProfile}
        billing={[
          { id: 'pay-1', amount: 9900, currency: 'GBP', status: 'succeeded', created_at: '2026-06-01T00:00:00.000Z', receipt_url: 'https://stripe.test/inv_1.pdf' },
        ]}
      />,
    )
    const link = screen.getByRole('link', { name: /invoice|download|pdf/i })
    expect(link).toHaveAttribute('href', 'https://stripe.test/inv_1.pdf')
  })

  it('shows upgrade/downgrade with effective date and price difference', () => {
    render(<BrandSettingsForm profile={baseProfile} subscription={subscription} />)
    // current tier is 1 (£59); upgrading to tier 2 (£149) shows a +£90 difference
    expect(screen.getByText(/effective/i)).toBeInTheDocument()
    expect(screen.getByText(/\+£90/)).toBeInTheDocument()
  })
})
