import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import AgentProfileForm from './agent-profile-form'

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }))

// The "Apply for Verification" CTA invokes the B9 server action. We inject a
// spy so the test can assert it fires without a live Supabase client.
const applyForVerificationAction = vi.fn().mockResolvedValue({ ok: true })

function makeProfile(overrides: Record<string, unknown> = {}) {
  return {
    id: 'agent-1',
    verification_status: 'unverified',
    commission_rate: null,
    commission_rate_display: null,
    ...overrides,
  } as never
}

describe('AgentProfileForm', () => {
  beforeEach(() => {
    applyForVerificationAction.mockClear()
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, json: async () => makeProfile() })
    )
  })

  it('shows a grey "Unverified" badge when the agent is not verified', () => {
    render(
      <AgentProfileForm
        profile={makeProfile({ verification_status: 'unverified' })}
        onApplyForVerification={applyForVerificationAction}
      />
    )
    expect(screen.getByText(/unverified/i)).toBeInTheDocument()
  })

  it('shows a blue "Verified" badge when the agent is verified', () => {
    render(
      <AgentProfileForm
        profile={makeProfile({ verification_status: 'verified' })}
        onApplyForVerification={applyForVerificationAction}
      />
    )
    expect(screen.getByText(/^verified$/i)).toBeInTheDocument()
    // The CTA is hidden once verified.
    expect(
      screen.queryByRole('button', { name: /apply for verification/i })
    ).not.toBeInTheDocument()
  })

  it('renders a prominent "Apply for Verification" CTA for an unverified agent', () => {
    render(
      <AgentProfileForm
        profile={makeProfile({ verification_status: 'unverified' })}
        onApplyForVerification={applyForVerificationAction}
      />
    )
    expect(
      screen.getByRole('button', { name: /apply for verification/i })
    ).toBeInTheDocument()
  })

  it('calls applyForVerification when the CTA is clicked', async () => {
    render(
      <AgentProfileForm
        profile={makeProfile({ verification_status: 'unverified' })}
        onApplyForVerification={applyForVerificationAction}
      />
    )
    await userEvent.click(
      screen.getByRole('button', { name: /apply for verification/i })
    )
    await waitFor(() => expect(applyForVerificationAction).toHaveBeenCalledWith('agent-1'))
  })

  it('shows a pending state when verification is awaiting review', () => {
    render(
      <AgentProfileForm
        profile={makeProfile({ verification_status: 'pending' })}
        onApplyForVerification={applyForVerificationAction}
      />
    )
    expect(screen.getByText(/under review/i)).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: /apply for verification/i })
    ).not.toBeInTheDocument()
  })

  it('renders a commission rate field with an informational tooltip', async () => {
    render(
      <AgentProfileForm
        profile={makeProfile()}
        onApplyForVerification={applyForVerificationAction}
      />
    )
    expect(screen.getByRole('spinbutton', { name: /commission rate/i })).toBeInTheDocument()
    // The tooltip trigger explains the field is informational only.
    const tip = screen.getByRole('button', { name: /about commission rate/i })
    await userEvent.click(tip)
    expect(screen.getByText(/informational only/i)).toBeInTheDocument()
  })

  it('renders an athlete-facing explainer that commission is agreed privately', () => {
    render(
      <AgentProfileForm
        profile={makeProfile()}
        onApplyForVerification={applyForVerificationAction}
      />
    )
    expect(
      screen.getByText(/agreed privately/i)
    ).toBeInTheDocument()
    expect(screen.getByText(/not enforced by podium/i)).toBeInTheDocument()
  })
})
