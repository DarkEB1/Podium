import { render, screen, waitFor, within, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import TeamSettingsForm from './team-settings-form'
import type { TeamAdmin } from '@/lib/supabase/teams'

// jsdom lacks PointerEvent / pointer-capture, which Base UI's Switch relies on.
if (typeof (globalThis as { PointerEvent?: unknown }).PointerEvent === 'undefined') {
  ;(globalThis as { PointerEvent: unknown }).PointerEvent = class extends MouseEvent {} as unknown
}

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }))

const toastSuccess = vi.fn()
const toastError = vi.fn()
vi.mock('sonner', () => ({
  toast: {
    success: (...args: unknown[]) => toastSuccess(...args),
    error: (...args: unknown[]) => toastError(...args),
  },
}))

function admin(overrides: Partial<TeamAdmin>): TeamAdmin {
  return {
    id: 'a1',
    team_id: 'team1',
    user_id: 'u1',
    invited_by: 'u0',
    invited_email: 'owner@club.com',
    full_name: 'Owner Person',
    role: 'primary',
    invite_status: 'accepted',
    invited_at: '2026-01-01T00:00:00.000Z',
    accepted_at: '2026-01-02T00:00:00.000Z',
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-02T00:00:00.000Z',
    ...overrides,
  }
}

function setup(props: Partial<React.ComponentProps<typeof TeamSettingsForm>> = {}) {
  const handlers = {
    onInviteAdmin: vi.fn().mockResolvedValue(undefined),
    onChangeAdminRole: vi.fn().mockResolvedValue(undefined),
    onRemoveAdmin: vi.fn().mockResolvedValue(undefined),
    onResendInvite: vi.fn().mockResolvedValue(undefined),
    onUpdateVisibility: vi.fn().mockResolvedValue(undefined),
    onUpdateSectionVisibility: vi.fn().mockResolvedValue(undefined),
    onUpdateFanReach: vi.fn().mockResolvedValue(undefined),
  }
  render(
    <TeamSettingsForm
      currentUserId="u0"
      admins={[
        admin({ id: 'a1', user_id: 'u0', role: 'primary', invite_status: 'accepted' }),
        admin({
          id: 'a2',
          user_id: 'u2',
          role: 'standard',
          full_name: 'Standard Sam',
          invited_email: 'sam@club.com',
          invite_status: 'accepted',
        }),
        admin({
          id: 'a3',
          user_id: null,
          role: 'view_only',
          full_name: null,
          invited_email: 'pending@club.com',
          invite_status: 'invited',
          accepted_at: null,
        }),
      ]}
      fanReach="regional"
      profileVisible
      sectionVisibility={{ contact: true, financials: false }}
      {...handlers}
      {...props}
    />,
  )
  return handlers
}

describe('TeamSettingsForm (TM3)', () => {
  it('renders the administrator table with name, role, email and last-active', () => {
    setup()
    const table = screen.getByRole('table', { name: /administrator/i })
    expect(within(table).getByText('Standard Sam')).toBeInTheDocument()
    expect(within(table).getByText('sam@club.com')).toBeInTheDocument()
    // role select reflects the stored role
    const samRole = screen.getByLabelText(/role for sam@club.com/i) as HTMLSelectElement
    expect(samRole.value).toBe('standard')
  })

  it('offers Primary, Standard and View Only roles', () => {
    setup()
    const samRole = screen.getByLabelText(/role for sam@club.com/i)
    const values = Array.from(samRole.querySelectorAll('option')).map(
      (o) => (o as HTMLOptionElement).value,
    )
    expect(values).toEqual(
      expect.arrayContaining(['primary', 'standard', 'view_only']),
    )
  })

  it('changes an administrator role via onChangeAdminRole', async () => {
    const { onChangeAdminRole } = setup()
    await userEvent.selectOptions(
      screen.getByLabelText(/role for sam@club.com/i),
      'view_only',
    )
    await waitFor(() =>
      expect(onChangeAdminRole).toHaveBeenCalledWith('a2', 'view_only'),
    )
  })

  it('shows Resend invite only for unaccepted administrators', () => {
    setup()
    expect(
      screen.getByRole('button', { name: /resend invite to pending@club.com/i }),
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: /resend invite to sam@club.com/i }),
    ).not.toBeInTheDocument()
  })

  it('resends an invite for an unaccepted administrator', async () => {
    const { onResendInvite } = setup()
    await userEvent.click(
      screen.getByRole('button', { name: /resend invite to pending@club.com/i }),
    )
    await waitFor(() => expect(onResendInvite).toHaveBeenCalledWith('a3'))
  })

  // PM-14: a failed resend must NOT toast success.
  it('does not report success when resend fails', async () => {
    toastSuccess.mockClear()
    toastError.mockClear()
    setup({ onResendInvite: vi.fn().mockRejectedValue(new Error('duplicate key')) })
    await userEvent.click(
      screen.getByRole('button', { name: /resend invite to pending@club.com/i }),
    )
    await waitFor(() => expect(toastError).toHaveBeenCalled())
    expect(toastSuccess).not.toHaveBeenCalled()
  })

  it('requires confirmation before removing an administrator', async () => {
    const { onRemoveAdmin } = setup()
    await userEvent.click(
      screen.getByRole('button', { name: /remove sam@club.com/i }),
    )
    // not removed until confirmed
    expect(onRemoveAdmin).not.toHaveBeenCalled()
    await userEvent.click(
      screen.getByRole('button', { name: /confirm removal/i }),
    )
    await waitFor(() => expect(onRemoveAdmin).toHaveBeenCalledWith('a2'))
  })

  it('invites a new administrator with an email and role', async () => {
    const { onInviteAdmin } = setup()
    await userEvent.type(
      screen.getByLabelText(/invite by email/i),
      'new@club.com',
    )
    await userEvent.click(screen.getByRole('button', { name: /^send invite$/i }))
    await waitFor(() =>
      expect(onInviteAdmin).toHaveBeenCalledWith(
        expect.objectContaining({ email: 'new@club.com' }),
      ),
    )
  })

  it('toggles profile visibility with an explanation of what it controls', async () => {
    const { onUpdateVisibility } = setup()
    expect(screen.getByText(/who can find and view your team/i)).toBeInTheDocument()
    fireEvent.click(screen.getByLabelText(/team profile is visible/i))
    await waitFor(() => expect(onUpdateVisibility).toHaveBeenCalledWith(false))
  })

  it('toggles a per-section public control', async () => {
    const { onUpdateSectionVisibility } = setup()
    fireEvent.click(screen.getByLabelText(/show financials publicly/i))
    await waitFor(() =>
      expect(onUpdateSectionVisibility).toHaveBeenCalledWith('financials', true),
    )
  })

  it('quick-edits fan-base reach', async () => {
    const { onUpdateFanReach } = setup()
    const region = screen.getByRole('region', { name: 'Fan-base reach' })
    await userEvent.selectOptions(
      within(region).getByLabelText('Fan-base reach'),
      'national',
    )
    await waitFor(() => expect(onUpdateFanReach).toHaveBeenCalledWith('national'))
  })
})
