import type { SupabaseClient } from '@supabase/supabase-js'

import { getPublicProfile } from '@/lib/supabase/profiles'
import type { Database } from '@/types/database'

type AthleteRow = Database['public']['Tables']['athlete_profiles']['Row']
type TeamRow = Database['public']['Tables']['team_profiles']['Row']

/** The display fields the agent roster and dashboard both need per client. */
export interface ClientDisplay {
  name: string
  photoUrl: string | null
  sport: string | null
  level: string | null
  lastActivity: string | null
}

/** A representation link, narrowed to the two fields resolution needs. */
export interface ResolvableLink {
  client_user_id: string
  client_role: string
}

/**
 * Covers both level enums, because the roster mixes both kinds of client:
 * `athlete_level` (recreational..international) and `team_level`
 * (grassroots, college, semi_pro, professional, international). The extra
 * athlete keys below are not in the enum but were already being labelled by the
 * two pages this replaces, so they are kept rather than silently dropped.
 */
const LEVEL_LABELS: Record<string, string> = {
  recreational: 'Recreational',
  amateur: 'Amateur',
  semi_professional: 'Semi-Professional',
  professional: 'Professional',
  international: 'International',
  university_bucs: 'University/BUCS',
  academy: 'Academy',
  national: 'National',
  grassroots: 'Grassroots',
  college: 'College',
  semi_pro: 'Semi-Pro',
}

function label(value: string | null | undefined): string | null {
  if (!value) return null
  return LEVEL_LABELS[value] ?? value
}

/**
 * Resolves each representation link to the display fields the roster shows.
 *
 * Both agent surfaces used to enrich only links whose `client_role` was
 * 'athlete', while still rendering a row for every link. A team client therefore
 * appeared as a nameless "Client" with no sport and no level. Teams could not be
 * added through the UI at the time so it never showed, but it made the athlete
 * filter look deliberate rather than a gap.
 *
 * Unresolvable clients keep a neutral placeholder rather than being dropped: the
 * roster row is what revokes the link, so hiding it would strip the agent of the
 * only way to end a representation whose profile has since been deactivated.
 */
export async function resolveClientDisplays(
  supabase: SupabaseClient<Database>,
  links: readonly ResolvableLink[]
): Promise<Map<string, ClientDisplay>> {
  const byUserId = new Map<string, ClientDisplay>()

  await Promise.all(
    links.map(async (link) => {
      if (link.client_role === 'team') {
        // getPublicProfile returns the role union; client_role narrows it.
        const team = (await getPublicProfile(
          supabase,
          link.client_user_id,
          'team'
        )) as TeamRow | null
        if (!team) return
        byUserId.set(link.client_user_id, {
          name: team.team_name ?? 'Team',
          photoUrl: team.logo_url ?? team.cover_photo_url ?? null,
          sport: team.sports?.[0] ?? null,
          level: label(team.competition_level),
          // team_profiles carries no last_active_at column (only athlete_profiles
          // and users do), so the roster shows "no activity recorded" for teams
          // rather than inventing a timestamp from updated_at.
          lastActivity: null,
        })
        return
      }

      const athlete = (await getPublicProfile(
        supabase,
        link.client_user_id,
        'athlete'
      )) as AthleteRow | null
      if (!athlete) return
      byUserId.set(link.client_user_id, {
        name: athlete.display_name ?? 'Athlete',
        photoUrl: athlete.profile_photo_url ?? null,
        sport: athlete.primary_sport ?? null,
        level: label(athlete.level),
        lastActivity: athlete.last_active_at ?? null,
      })
    })
  )

  return byUserId
}

/** Placeholder for a link whose client profile could not be read. */
export const UNKNOWN_CLIENT: ClientDisplay = {
  name: 'Client',
  photoUrl: null,
  sport: null,
  level: null,
  lastActivity: null,
}
