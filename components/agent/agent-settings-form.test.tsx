import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import AgentSettingsForm from './agent-settings-form'

// jsdom lacks PointerEvent / pointer-capture, which Base UI's Switch relies on.
// Provide a minimal shim so switch clicks dispatch in tests.
if (typeof (globalThis as { PointerEvent?: unknown }).PointerEvent === 'undefined') {
  ;(globalThis as { PointerEvent: unknown }).PointerEvent = class extends MouseEvent {} as unknown
}

// updateSettings (B9) is the persistence path for visibility/discovery toggles.
const updateSettings = vi.fn().mockResolvedValue({})
vi.mock('@/lib/supabase/settings', () => ({
  updateSettings: (...args: unknown[]) => updateSettings(...args),
}))
vi.mock('@/lib/supabase/client', () => ({ createClient: () => ({}) }))

const baseProfile = {
  id: 'agent-1',
  user_id: 'user-1',
  agency_name: 'Apex Sports',
  agent_full_name: 'Jordan Lee',
  bio: 'Representing rising talent.',
  commission_rate: 12,
  website_url: '',
  linkedin_url: '',
  verification_status: 'verified',
} as never

const baseSettings = {
  profile_visible: true,
  discoverable: true,
  marketing_opt_in: false,
} as never

describe('AgentSettingsForm', () => {
  beforeEach(() => {
    updateSettings.mockClear()
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, json: async () => ({ id: 'agent-1' }) }),
    )
  })

  it('renders the settings section navigation', () => {
    render(<AgentSettingsForm profile={baseProfile} settings={baseSettings} />)
    const nav = screen.getByRole('navigation', { name: /settings sections/i })
    expect(nav).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /agency profile/i })).toBeInTheDocument()
  })

  it('pre-fills the agency profile fields', () => {
    render(<AgentSettingsForm profile={baseProfile} settings={baseSettings} />)
    expect(screen.getByDisplayValue('Apex Sports')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Jordan Lee')).toBeInTheDocument()
  })

  it('saves the agency profile via PATCH /api/profiles/me', async () => {
    render(<AgentSettingsForm profile={baseProfile} settings={baseSettings} />)
    await userEvent.click(screen.getByRole('button', { name: /save profile/i }))
    await waitFor(() =>
      expect(fetch).toHaveBeenCalledWith(
        '/api/profiles/me',
        expect.objectContaining({ method: 'PATCH' }),
      ),
    )
  })

  it('persists the discoverable toggle through updateSettings', async () => {
    render(<AgentSettingsForm profile={baseProfile} settings={baseSettings} />)
    fireEvent.click(screen.getByRole('switch', { name: /discoverable/i }))
    await waitFor(() =>
      expect(updateSettings).toHaveBeenCalledWith(
        expect.anything(),
        'user-1',
        expect.objectContaining({ discoverable: false }),
      ),
    )
  })
})
