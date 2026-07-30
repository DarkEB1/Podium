import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/supabase/profiles', () => ({ getPublicProfile: vi.fn() }))

import { getPublicProfile } from '@/lib/supabase/profiles'
import { resolveClientDisplays, UNKNOWN_CLIENT } from './agent-clients'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

const supabase = {} as SupabaseClient<Database>

/** Routes the mocked getPublicProfile by (userId, role). */
function stubProfiles(rows: Record<string, Record<string, unknown>>) {
  vi.mocked(getPublicProfile).mockImplementation(
    async (_client, userId, role) =>
      (rows[`${userId}:${role}`] ?? null) as never
  )
}

describe('resolveClientDisplays', () => {
  beforeEach(() => vi.clearAllMocks())

  it('resolves an athlete client', async () => {
    stubProfiles({
      'u1:athlete': {
        display_name: 'Maya Okafor',
        profile_photo_url: 'https://x/maya.jpg',
        primary_sport: 'Athletics',
        level: 'semi_professional',
        last_active_at: '2026-07-01T00:00:00.000Z',
      },
    })

    const result = await resolveClientDisplays(supabase, [
      { client_user_id: 'u1', client_role: 'athlete' },
    ])

    expect(result.get('u1')).toEqual({
      name: 'Maya Okafor',
      photoUrl: 'https://x/maya.jpg',
      sport: 'Athletics',
      level: 'Semi-Professional',
      lastActivity: '2026-07-01T00:00:00.000Z',
    })
  })

  // The gap: both agent surfaces filtered enrichment to client_role 'athlete'
  // while still rendering a row for every link, so a team client appeared as a
  // nameless "Client" with no sport and no level.
  it('resolves a team client instead of leaving it nameless', async () => {
    stubProfiles({
      'u2:team': {
        team_name: 'Riverside Falcons',
        logo_url: 'https://x/falcons.png',
        cover_photo_url: null,
        sports: ['Football', 'Futsal'],
        competition_level: 'semi_pro',
      },
    })

    const result = await resolveClientDisplays(supabase, [
      { client_user_id: 'u2', client_role: 'team' },
    ])

    expect(result.get('u2')).toEqual({
      name: 'Riverside Falcons',
      photoUrl: 'https://x/falcons.png',
      sport: 'Football',
      // team_level 'semi_pro' is a different enum value from athlete_level
      // 'semi_professional'; both must label.
      level: 'Semi-Pro',
      // team_profiles has no last_active_at column.
      lastActivity: null,
    })
  })

  it('looks each client up in its own table, never the wrong one', async () => {
    stubProfiles({ 'u2:team': { team_name: 'Falcons', sports: [] } })
    await resolveClientDisplays(supabase, [{ client_user_id: 'u2', client_role: 'team' }])
    expect(getPublicProfile).toHaveBeenCalledWith(supabase, 'u2', 'team')
    expect(getPublicProfile).not.toHaveBeenCalledWith(supabase, 'u2', 'athlete')
  })

  it('handles a mixed roster in one pass', async () => {
    stubProfiles({
      'u1:athlete': { display_name: 'Maya', sports: [] },
      'u2:team': { team_name: 'Falcons', sports: [] },
    })

    const result = await resolveClientDisplays(supabase, [
      { client_user_id: 'u1', client_role: 'athlete' },
      { client_user_id: 'u2', client_role: 'team' },
    ])

    expect(result.get('u1')?.name).toBe('Maya')
    expect(result.get('u2')?.name).toBe('Falcons')
  })

  // The roster row is what revokes a representation link, so a client whose
  // profile has since been deactivated must still be listed or the agent has no
  // way to end the representation.
  it('omits an unresolvable client so the caller can fall back, not drop the row', async () => {
    stubProfiles({})
    const result = await resolveClientDisplays(supabase, [
      { client_user_id: 'gone', client_role: 'athlete' },
    ])
    expect(result.has('gone')).toBe(false)
    expect(UNKNOWN_CLIENT.name).toBe('Client')
  })

  it('falls back to the cover photo when a team has no logo', async () => {
    stubProfiles({
      'u3:team': { team_name: 'Falcons', logo_url: null, cover_photo_url: 'https://x/c.jpg', sports: [] },
    })
    const result = await resolveClientDisplays(supabase, [
      { client_user_id: 'u3', client_role: 'team' },
    ])
    expect(result.get('u3')?.photoUrl).toBe('https://x/c.jpg')
  })
})
