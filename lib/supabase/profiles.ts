import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import { db } from '@/lib/supabase/typed-client'

export type ProfileRole = 'athlete' | 'team' | 'brand' | 'agent'

type AthleteRow = Database['public']['Tables']['athlete_profiles']['Row']
type TeamRow = Database['public']['Tables']['team_profiles']['Row']
type BrandRow = Database['public']['Tables']['brand_profiles']['Row']
type AgentRow = Database['public']['Tables']['agent_profiles']['Row']
type RepLinkRow = Database['public']['Tables']['representation_links']['Row']

export type ProfileRow = AthleteRow | TeamRow | BrandRow | AgentRow

const TABLE_FOR_ROLE = {
  athlete: 'athlete_profiles',
  team: 'team_profiles',
  brand: 'brand_profiles',
  agent: 'agent_profiles',
} as const

// Fields users must never be able to set directly — status is controlled via publishProfile,
// admin fields require service-role, computed fields are managed by DB triggers.
const PROTECTED_FIELDS = new Set([
  'id',
  'user_id',
  'created_at',
  'updated_at',
  'status',
  'admin_approved_at',
  'admin_approved_by',
  'rejection_reason',
  'is_under_18',
  'is_verified',
  'verified_at',
  'last_active_at',
])

/**
 * Strip protected fields and normalise the payload.
 *
 * `clearEmpty` chooses what an empty string means:
 *  - create (`false`, default): drop it, so the column falls back to its DB
 *    default. There is nothing to clear on a brand-new row.
 *  - update (`true`): map it to `null` so a user can genuinely CLEAR a set
 *    optional field (phone, secondary sport, city, LinkedIn…). Dropping it, as
 *    the old code did for every path, silently kept the old value while the form
 *    toasted "saved" (PM-15).
 *
 * DENYLIST COMPOSITION (WS-SEC coordination): the PROTECTED_FIELDS filter runs
 * FIRST, unconditionally, before any empty->null mapping. So clearing can only
 * ever touch a NON-protected field, and empty-string clearing can never become
 * a back door for writing a protected column. This holds no matter how
 * PROTECTED_FIELDS grows: when the WS-SEC branch merges its additions
 * (guardian_accepted_at, payout_*, stripe_connect_*, onboarding_completed_at,
 * verification_status), a `{ payout_account_last4: '' }` body is dropped by the
 * filter and never reaches the `null` map. Keep the filter ahead of the map.
 */
function sanitizeProfileData(
  data: Record<string, unknown>,
  { clearEmpty = false }: { clearEmpty?: boolean } = {}
): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(data)
      // Denylist first — a protected field is gone before the map below can see it.
      .filter(([key, value]) => {
        if (PROTECTED_FIELDS.has(key)) return false
        if (value === '' && !clearEmpty) return false
        return true
      })
      .map(([key, value]) => [key, value === '' ? null : value])
  )
}

export class ProfileError extends Error {
  constructor(
    public readonly code: string,
    message: string
  ) {
    super(message)
    this.name = 'ProfileError'
  }
}

export async function createProfile(
  supabase: SupabaseClient<Database>,
  userId: string,
  role: ProfileRole,
  data: Record<string, unknown>
): Promise<ProfileRow> {
  const table = TABLE_FOR_ROLE[role]
  const safe = sanitizeProfileData(data)
  const { data: profile, error } = await db(supabase)
    .from(table)
    .insert({ ...safe, user_id: userId })
    .select()
    .single()

  if (error) {
    if ((error as { code?: string }).code === '23505') {
      throw new ProfileError('PROFILE_ALREADY_EXISTS', 'A profile already exists for this user')
    }
    throw new ProfileError('PROFILE_CREATE_FAILED', (error as { message: string }).message)
  }

  return profile as ProfileRow
}

export async function getOwnProfile(
  supabase: SupabaseClient<Database>,
  userId: string,
  role: ProfileRole
): Promise<ProfileRow | null> {
  const table = TABLE_FOR_ROLE[role]
  const { data, error } = await db(supabase)
    .from(table)
    .select('*')
    .eq('user_id', userId)
    .single()

  if (error) {
    if ((error as { code?: string }).code === 'PGRST116') return null
    throw new ProfileError('PROFILE_FETCH_FAILED', (error as { message: string }).message)
  }

  return data as ProfileRow
}

export async function updateProfile(
  supabase: SupabaseClient<Database>,
  userId: string,
  role: ProfileRole,
  data: Record<string, unknown>
): Promise<ProfileRow> {
  const table = TABLE_FOR_ROLE[role]
  const safe = sanitizeProfileData(data, { clearEmpty: true })
  const { data: profile, error } = await db(supabase)
    .from(table)
    .update(safe)
    .eq('user_id', userId)
    .select()
    .single()

  if (error) {
    if ((error as { code?: string }).code === 'PGRST116') {
      throw new ProfileError('PROFILE_NOT_FOUND', 'No profile found for this user')
    }
    throw new ProfileError('PROFILE_UPDATE_FAILED', (error as { message: string }).message)
  }

  return profile as ProfileRow
}

export async function publishProfile(
  supabase: SupabaseClient<Database>,
  userId: string,
  role: ProfileRole
): Promise<void> {
  if (role === 'brand') {
    throw new ProfileError(
      'BRAND_NOT_PUBLISHABLE',
      'Brand profiles require admin approval and cannot be published directly'
    )
  }

  const table = TABLE_FOR_ROLE[role]
  const { error } = await db(supabase)
    .from(table)
    .update({ status: 'active' })
    .eq('user_id', userId)
    .select()
    .single()

  if (error) {
    if ((error as { code?: string }).code === 'PGRST116') {
      throw new ProfileError('PROFILE_NOT_FOUND', 'No profile found for this user')
    }
    throw new ProfileError('PROFILE_PUBLISH_FAILED', (error as { message: string }).message)
  }
}

/**
 * Records that a brand has submitted the final onboarding step.
 *
 * Deliberately separate from `publishProfile`, and deliberately not a `status`
 * write. `brand_status` is ('pending_approval','active','suspended','rejected')
 * and is owned by admin review, so it has no value meaning "still filling in
 * the wizard" and cannot be borrowed as one. Reusing it was the bug: because no
 * brand status is ever `'draft'`, the onboarding gate's shared
 * `status !== 'draft'` test passed the instant step 1 created the row, and a
 * brand could walk away with steps 2 to 4 empty and never be asked to return.
 *
 * The two states are genuinely independent: a brand that has finished the wizard
 * and is awaiting approval is onboarded (it must be able to reach
 * `/brand/subscription`) but not yet active.
 */
export async function completeBrandOnboarding(
  supabase: SupabaseClient<Database>,
  userId: string
): Promise<void> {
  const { error } = await db(supabase)
    .from('brand_profiles')
    .update({ onboarding_completed_at: new Date().toISOString() })
    .eq('user_id', userId)
    .select()
    .single()

  if (error) {
    if ((error as { code?: string }).code === 'PGRST116') {
      throw new ProfileError('PROFILE_NOT_FOUND', 'No profile found for this user')
    }
    throw new ProfileError(
      'ONBOARDING_COMPLETE_FAILED',
      (error as { message: string }).message
    )
  }
}

export async function getPublicProfile(
  supabase: SupabaseClient<Database>,
  targetUserId: string,
  role: ProfileRole
): Promise<ProfileRow | null> {
  const table = TABLE_FOR_ROLE[role]
  const { data, error } = await db(supabase)
    .from(table)
    .select('*')
    .eq('user_id', targetUserId)
    .eq('status', 'active')
    .single()

  if (error) {
    if ((error as { code?: string }).code === 'PGRST116') return null
    throw new ProfileError('PROFILE_FETCH_FAILED', (error as { message: string }).message)
  }

  return data as ProfileRow
}

export async function createRepresentationLink(
  supabase: SupabaseClient<Database>,
  agentProfileId: string,
  clientUserId: string,
  clientRole: 'athlete' | 'team'
): Promise<RepLinkRow> {
  const { data, error } = await db(supabase)
    .from('representation_links')
    .insert({
      agent_id: agentProfileId,
      client_user_id: clientUserId,
      client_role: clientRole,
    })
    .select()
    .single()

  if (error) {
    throw new ProfileError('LINK_CREATE_FAILED', (error as { message: string }).message)
  }

  return data as RepLinkRow
}

export async function respondRepresentationLink(
  supabase: SupabaseClient<Database>,
  linkId: string,
  clientUserId: string,
  accept: boolean
): Promise<void> {
  const now = new Date().toISOString()
  const update = accept
    ? { status: 'active' as const, accepted_at: now }
    : { status: 'terminated' as const, terminated_at: now }

  const { error } = await db(supabase)
    .from('representation_links')
    .update(update)
    .eq('id', linkId)
    .eq('client_user_id', clientUserId)
    .select()
    .single()

  if (error) {
    if ((error as { code?: string }).code === 'PGRST116') {
      throw new ProfileError('LINK_NOT_FOUND', 'Representation link not found or not accessible')
    }
    throw new ProfileError('LINK_RESPOND_FAILED', (error as { message: string }).message)
  }
}

export async function getRepresentationLinks(
  supabase: SupabaseClient<Database>,
  clientUserId: string
): Promise<RepLinkRow[]> {
  const { data, error } = await db(supabase)
    .from('representation_links')
    .select('*')
    .eq('client_user_id', clientUserId)

  if (error) {
    throw new ProfileError('LINKS_FETCH_FAILED', (error as { message: string }).message)
  }

  return (data ?? []) as RepLinkRow[]
}

// ---------------------------------------------------------------------------
// Athlete discovery feed (FA-5 / SB-9 / FA-4)
// ---------------------------------------------------------------------------

/**
 * The columns the athlete discovery surfaces actually read.
 *
 * SB-9/FA-4: `select('*')` pulled every column of `athlete_profiles` —
 * including guardian contact details, payout account fragments and Stripe
 * Connect ids — into a public browse feed. Project instead: less data over the
 * wire, and nothing sensitive leaves the database for a listing card.
 */
const ATHLETE_SUMMARY_COLUMNS = [
  'id',
  'user_id',
  'display_name',
  'primary_sport',
  'secondary_sport',
  'level',
  'position',
  'home_city',
  'home_country',
  'travel_radius_km',
  'availability_status',
  'available_from_date',
  'profile_photo_url',
  'social_accounts',
  'last_active_at',
  'updated_at',
  'created_at',
  'status',
].join(', ')

type AthleteSummaryKeys =
  | 'id'
  | 'user_id'
  | 'display_name'
  | 'primary_sport'
  | 'secondary_sport'
  | 'level'
  | 'position'
  | 'home_city'
  | 'home_country'
  | 'travel_radius_km'
  | 'availability_status'
  | 'available_from_date'
  | 'profile_photo_url'
  | 'social_accounts'
  | 'last_active_at'
  | 'updated_at'
  | 'created_at'
  | 'status'

/** An athlete as the discovery feed sees them — see ATHLETE_SUMMARY_COLUMNS. */
export type AthleteSummary = Pick<AthleteRow, AthleteSummaryKeys>

/** Rows per discovery page. Bounded so a 20,000-athlete table is one page, not an outage. */
export const ATHLETE_PAGE_SIZE = 24

export interface AthletePage {
  athletes: AthleteSummary[]
  /** True when more rows exist past this page — drives the "Load more" control. */
  hasMore: boolean
}

/**
 * One bounded page of active athletes, newest-updated first.
 *
 * Range pagination (`offset` .. `offset + limit`) rather than a cursor: the sort
 * key is `updated_at`, which is not unique and mutates, so a cursor would be no
 * more stable here than an offset and would be harder to render as "load more".
 * Fetches `limit + 1` rows so `hasMore` is exact and needs no count query.
 */
export async function getActiveAthleteProfilesPage(
  supabase: SupabaseClient<Database>,
  options: { limit?: number; offset?: number } = {}
): Promise<AthletePage> {
  const limit = Math.max(1, options.limit ?? ATHLETE_PAGE_SIZE)
  const offset = Math.max(0, options.offset ?? 0)

  const { data, error } = await db(supabase)
    .from('athlete_profiles')
    .select(ATHLETE_SUMMARY_COLUMNS)
    .eq('status', 'active')
    .order('updated_at', { ascending: false })
    .range(offset, offset + limit) // limit + 1 rows: the extra one only answers hasMore

  if (error) throw new ProfileError('PROFILE_FETCH_FAILED', (error as { message: string }).message)

  // as unknown as AthleteSummary[]: the column list is built at runtime, so
  // PostgREST's literal-type select parser cannot infer the row shape.
  const rows = (data ?? []) as unknown as AthleteSummary[]
  return { athletes: rows.slice(0, limit), hasMore: rows.length > limit }
}

/**
 * Every active athlete. Still unbounded — kept for callers that genuinely need
 * the whole set (the agent client picker). Discovery surfaces must use
 * `getActiveAthleteProfilesPage`.
 */
export async function getActiveAthleteProfiles(
  supabase: SupabaseClient<Database>
): Promise<AthleteSummary[]> {
  const { data, error } = await db(supabase)
    .from('athlete_profiles')
    .select(ATHLETE_SUMMARY_COLUMNS)
    .eq('status', 'active')
    .order('updated_at', { ascending: false })

  if (error) throw new ProfileError('PROFILE_FETCH_FAILED', (error as { message: string }).message)
  // as unknown as AthleteSummary[]: runtime-built column list, see above.
  return (data ?? []) as unknown as AthleteSummary[]
}

// ---------------------------------------------------------------------------
// Team discovery (2.2) — the brand-side mirror of athlete discovery.
// ---------------------------------------------------------------------------

// SB-9/FA-4: project a public-safe column set. Commercial-manager and
// primary-controller contact details are PII and never ship to a browse feed.
const TEAM_SUMMARY_COLUMNS = [
  'id',
  'user_id',
  'team_name',
  'nickname',
  'sports',
  'competition_level',
  'logo_url',
  'cover_photo_url',
  'home_city',
  'home_country',
  'fan_reach',
  'total_social_following',
  'seeking_sponsorship_types',
  'social_accounts',
  'updated_at',
  'created_at',
  'status',
].join(', ')

type TeamSummaryKeys =
  | 'id'
  | 'user_id'
  | 'team_name'
  | 'nickname'
  | 'sports'
  | 'competition_level'
  | 'logo_url'
  | 'cover_photo_url'
  | 'home_city'
  | 'home_country'
  | 'fan_reach'
  | 'total_social_following'
  | 'seeking_sponsorship_types'
  | 'social_accounts'
  | 'updated_at'
  | 'created_at'
  | 'status'

/** A team as the brand discovery feed sees them — see TEAM_SUMMARY_COLUMNS. */
export type TeamSummary = Pick<TeamRow, TeamSummaryKeys>

export const TEAM_PAGE_SIZE = 24

export interface TeamPage {
  teams: TeamSummary[]
  hasMore: boolean
}

/**
 * One bounded page of active teams, newest-updated first. Same range-pagination
 * and `limit + 1` hasMore trick as getActiveAthleteProfilesPage.
 */
export async function getActiveTeamProfilesPage(
  supabase: SupabaseClient<Database>,
  options: { limit?: number; offset?: number } = {}
): Promise<TeamPage> {
  const limit = Math.max(1, options.limit ?? TEAM_PAGE_SIZE)
  const offset = Math.max(0, options.offset ?? 0)

  const { data, error } = await db(supabase)
    .from('team_profiles')
    .select(TEAM_SUMMARY_COLUMNS)
    .eq('status', 'active')
    .order('updated_at', { ascending: false })
    .range(offset, offset + limit)

  if (error) throw new ProfileError('PROFILE_FETCH_FAILED', (error as { message: string }).message)

  // as unknown as TeamSummary[]: runtime-built column list, see the athlete twin.
  const rows = (data ?? []) as unknown as TeamSummary[]
  return { teams: rows.slice(0, limit), hasMore: rows.length > limit }
}

/**
 * Every active team, unpaginated. The twin of `getActiveAthleteProfiles`, for
 * the same reason it exists: the agent "Add Client" picker needs the whole set
 * to mark which teams are already represented. Browse feeds must keep using
 * `getActiveTeamProfilesPage`.
 */
export async function getActiveTeamProfiles(
  supabase: SupabaseClient<Database>
): Promise<TeamSummary[]> {
  const { data, error } = await db(supabase)
    .from('team_profiles')
    .select(TEAM_SUMMARY_COLUMNS)
    .eq('status', 'active')
    .order('updated_at', { ascending: false })

  if (error) throw new ProfileError('PROFILE_FETCH_FAILED', (error as { message: string }).message)
  // as unknown as TeamSummary[]: runtime-built column list, see the athlete twin.
  return (data ?? []) as unknown as TeamSummary[]
}

// ---------------------------------------------------------------------------
// Discovery UI mode (PR-23)
// ---------------------------------------------------------------------------

export type DiscoveryUiMode = Database['public']['Enums']['ui_mode']

/**
 * The user's persisted browse mode. Every profile table carries
 * `discovery_ui_mode public.ui_mode not null default 'marketplace'`
 * (supabase/migrations/20260419000002_profiles.sql), so this is a real column,
 * not a preference invented in the client.
 */
export async function getDiscoveryUiMode(
  supabase: SupabaseClient<Database>,
  userId: string,
  role: ProfileRole
): Promise<DiscoveryUiMode> {
  const table = TABLE_FOR_ROLE[role]
  const { data, error } = await db(supabase)
    .from(table)
    .select('discovery_ui_mode')
    .eq('user_id', userId)
    .single()

  // A missing profile is not an error for a display preference — fall back to
  // the column default rather than blowing up the page that renders the toggle.
  if (error || !data) return 'marketplace'
  return ((data as { discovery_ui_mode?: DiscoveryUiMode }).discovery_ui_mode ??
    'marketplace') as DiscoveryUiMode
}

/**
 * Persist the browse mode. Written through `updateProfile` so it goes through
 * the same sanitizer as every other profile write (`discovery_ui_mode` is not a
 * protected field, so `PATCH /api/profiles/me` accepts it from the client).
 */
export async function updateDiscoveryUiMode(
  supabase: SupabaseClient<Database>,
  userId: string,
  role: ProfileRole,
  mode: DiscoveryUiMode
): Promise<void> {
  await updateProfile(supabase, userId, role, { discovery_ui_mode: mode })
}
