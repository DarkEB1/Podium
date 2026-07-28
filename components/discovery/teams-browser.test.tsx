import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

import TeamsBrowser from './teams-browser'
import type { TeamSummary } from '@/lib/supabase/profiles'

const team = (over: Partial<TeamSummary> = {}): TeamSummary =>
  ({
    id: 't1',
    user_id: 'team-user-1',
    team_name: 'Leeds Lions',
    nickname: 'Lions',
    sports: ['Football'],
    competition_level: 'semi_pro',
    logo_url: null,
    cover_photo_url: null,
    home_city: 'Leeds',
    home_country: 'UK',
    fan_reach: 'regional',
    total_social_following: 12000,
    seeking_sponsorship_types: ['shirt_sponsorship'],
    social_accounts: null,
    updated_at: '2026-01-01',
    created_at: '2026-01-01',
    status: 'active',
    ...over,
  }) as TeamSummary

const fetchMock = vi.fn()

beforeEach(() => {
  fetchMock.mockReset()
  fetchMock.mockResolvedValue({ ok: true, status: 201, json: async () => ({}) })
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('TeamsBrowser', () => {
  it('renders the toggle above the teams grid', () => {
    render(<TeamsBrowser teams={[team()]} initialMode="marketplace" />)
    expect(screen.getByRole('radiogroup', { name: /browse mode/i })).toBeInTheDocument()
    expect(screen.getByText('Leeds Lions')).toBeInTheDocument()
  })

  it('swiping save POSTs the team to the shortlist API', async () => {
    render(<TeamsBrowser teams={[team()]} initialMode="swipe" />)

    await userEvent.click(screen.getByRole('button', { name: /save/i }))

    await waitFor(() => {
      const call = fetchMock.mock.calls.find(([url]) => url === '/api/discovery/shortlist')
      expect(call).toBeDefined()
      expect(JSON.parse((call![1] as RequestInit).body as string)).toEqual({
        target_user_id: 'team-user-1',
      })
    })
  })

  it('filters teams by search text', async () => {
    render(
      <TeamsBrowser
        teams={[team(), team({ id: 't2', user_id: 'team-user-2', team_name: 'York Foxes' })]}
        initialMode="marketplace"
      />
    )
    expect(screen.getByText('Leeds Lions')).toBeInTheDocument()
    expect(screen.getByText('York Foxes')).toBeInTheDocument()

    await userEvent.type(screen.getByLabelText(/search teams/i), 'York')

    await waitFor(() => {
      expect(screen.queryByText('Leeds Lions')).not.toBeInTheDocument()
      expect(screen.getByText('York Foxes')).toBeInTheDocument()
    })
  })
})
