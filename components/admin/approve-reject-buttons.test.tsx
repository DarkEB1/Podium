import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import ApproveRejectButtons from './approve-reject-buttons'

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }))

describe('ApproveRejectButtons', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ id: 'p1', profile_type: 'athlete', status: 'active' }),
    }))
  })

  it('renders approve and reject buttons', () => {
    render(<ApproveRejectButtons profileId="p1" profileType="athlete" currentStatus="pending_review" />)
    expect(screen.getByRole('button', { name: /approve profile/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /reject profile/i })).toBeInTheDocument()
  })

  it('shows confirmation after clicking approve', async () => {
    render(<ApproveRejectButtons profileId="p1" profileType="athlete" currentStatus="pending_review" />)
    await userEvent.click(screen.getByRole('button', { name: /approve profile/i }))
    expect(screen.getByRole('button', { name: /confirm approve/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument()
  })

  it('shows confirmation after clicking reject', async () => {
    render(<ApproveRejectButtons profileId="p1" profileType="athlete" currentStatus="pending_review" />)
    await userEvent.click(screen.getByRole('button', { name: /reject profile/i }))
    expect(screen.getByRole('button', { name: /confirm reject/i })).toBeInTheDocument()
  })

  it('calls PATCH /api/admin/profiles/:id with approve action on confirm', async () => {
    render(<ApproveRejectButtons profileId="p1" profileType="athlete" currentStatus="pending_review" />)
    await userEvent.click(screen.getByRole('button', { name: /approve profile/i }))
    await userEvent.click(screen.getByRole('button', { name: /confirm approve/i }))
    await waitFor(() =>
      expect(fetch).toHaveBeenCalledWith(
        '/api/admin/profiles/p1',
        expect.objectContaining({
          method: 'PATCH',
          body: JSON.stringify({ action: 'approve', profile_type: 'athlete' }),
        })
      )
    )
  })

  it('shows already active message when profile is active', () => {
    render(<ApproveRejectButtons profileId="p1" profileType="athlete" currentStatus="active" />)
    expect(screen.getByText(/already active/i)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /approve/i })).not.toBeInTheDocument()
  })
})
