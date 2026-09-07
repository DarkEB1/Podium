import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import { db } from '@/lib/supabase/typed-client'

type TeamProfileRow = Database['public']['Tables']['team_profiles']['Row']
type TeamProfileInsert = Database['public']['Tables']['team_profiles']['Insert']
type TeamAdminRow = Database['public']['Tables']['team_admins']['Row']
type TeamAdminRole = Database['public']['Enums']['team_admin_role']

export type TeamProfile = TeamProfileRow
export type TeamAdmin = TeamAdminRow

// Columns the caller must never set on profile creation. Identity / audit
// columns are managed by the DB and triggers; `status` is set by
// createTeamProfile itself, never by the submitted form payload.
const PROTECTED_TEAM_FIELDS = new Set<string>([
  'id',
  'user_id',
  'created_at',
  'updated_at',
  'status',
])

/**
 * Strip protected fields and normalise the payload. `clearEmpty` mirrors
 * profiles.sanitizeProfileData: on create ('' dropped, column default applies);
 * on update ('' -> null so an optional field can genuinely be cleared, PM-15).
 * The protected-field filter runs FIRST, so clearing can never write `status`,
 * `id`, `user_id` or an audit column.
 */
function sanitizeTeamData(
  data: Record<string, unknown>,
  { clearEmpty = false }: { clearEmpty?: boolean } = {}
): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(data)
      .filter(([key, value]) => {
        if (PROTECTED_TEAM_FIELDS.has(key)) return false
        if (value === '' && !clearEmpty) return false
        return true
      })
      .map(([key, value]) => [key, value === '' ? null : value])
  )
}

export class TeamError extends Error {
  constructor(
    public readonly code: string,
    message: string
  ) {
    super(message)
    this.name = 'TeamError'
  }
}

// ---------------------------------------------------------------------------
// Team profile
// ---------------------------------------------------------------------------

export async function createTeamProfile(
  supabase: SupabaseClient<Database>,
  userId: string,
  data: TeamProfileInsert
): Promise<TeamProfile> {
  const clean = sanitizeTeamData(data as Record<string, unknown>)

  // status: 'active' is set here, not left to the column default of 'draft'.
  // Team onboarding is one form with no separate publish step (unlike the
  // athlete wizard, which finishes at /api/profiles/me/publish), and middleware
  // treats any 'draft' profile as onboarding-in-progress. A draft team profile
  // therefore means the team is redirected back into onboarding forever and can
  // never reach its dashboard or settings.
  const { data: row, error } = await db(supabase)
    .from('team_profiles')
    .insert({ ...clean, user_id: userId, status: 'active' })
    .select()
    .single()

  if (error) {
    throw new TeamError('TEAM_PROFILE_CREATE_FAILED', (error as { message: string }).message)
  }

  return row as TeamProfile
}

/**
 * PM-12 / WS-PROFILE-02: edit an existing team profile after onboarding.
 *
 * The mirror of createTeamProfile for updates. `status` stays protected — it is
 * owned by createTeamProfile and admin review, never by an edit form — and empty
 * strings clear optional columns (fan_reach, home_city, website, socials…)
 * rather than being silently dropped. Scoped by `user_id` so RLS owner policies
 * apply and a team can only edit its own row.
 */
export async function updateTeamProfile(
  supabase: SupabaseClient<Database>,
  userId: string,
  data: Record<string, unknown>
): Promise<TeamProfile> {
  const clean = sanitizeTeamData(data, { clearEmpty: true })
  const { data: row, error } = await db(supabase)
    .from('team_profiles')
    .update(clean)
    .eq('user_id', userId)
    .select()
    .single()

  if (error) {
    if ((error as { code?: string }).code === 'PGRST116') {
      throw new TeamError('TEAM_PROFILE_NOT_FOUND', 'No team profile found for this user')
    }
    throw new TeamError('TEAM_PROFILE_UPDATE_FAILED', (error as { message: string }).message)
  }

  return row as TeamProfile
}

export async function getTeamProfile(
  supabase: SupabaseClient<Database>,
  teamId: string
): Promise<TeamProfile | null> {
  const { data, error } = await db(supabase)
    .from('team_profiles')
    .select('*')
    .eq('id', teamId)
    .single()

  if (error) {
    if ((error as { code?: string }).code === 'PGRST116') return null
    throw new TeamError('TEAM_PROFILE_FETCH_FAILED', (error as { message: string }).message)
  }

  return data as TeamProfile
}

// ---------------------------------------------------------------------------
// Team admins (multi-admin)
// ---------------------------------------------------------------------------

export async function listTeamAdmins(
  supabase: SupabaseClient<Database>,
  teamId: string
): Promise<TeamAdmin[]> {
  const { data, error } = await db(supabase)
    .from('team_admins')
    .select('*')
    .eq('team_id', teamId)
    .order('created_at', { ascending: true })

  if (error) {
    throw new TeamError('TEAM_ADMINS_FETCH_FAILED', (error as { message: string }).message)
  }

  return (data ?? []) as TeamAdmin[]
}

export async function inviteTeamAdmin(
  supabase: SupabaseClient<Database>,
  teamId: string,
  invitedBy: string,
  invite: { email: string; role?: TeamAdminRole; fullName?: string }
): Promise<TeamAdmin> {
  // invite_status defaults to 'invited' at the DB level until the invitee accepts.
  const { data, error } = await db(supabase)
    .from('team_admins')
    .insert({
      team_id: teamId,
      invited_by: invitedBy,
      invited_email: invite.email,
      role: invite.role ?? 'standard',
      full_name: invite.fullName ?? null,
    })
    .select()
    .single()

  if (error) {
    throw new TeamError('TEAM_ADMIN_INVITE_FAILED', (error as { message: string }).message)
  }

  return data as TeamAdmin
}

/**
 * WS-PROFILE-02: change an administrator's role. Previously the settings action
 * threw "updateTeamAdmin helper (pending)". RLS restricts the write to the
 * team's primary admin.
 */
export async function updateTeamAdmin(
  supabase: SupabaseClient<Database>,
  adminId: string,
  patch: { role?: TeamAdminRole; fullName?: string }
): Promise<TeamAdmin> {
  const update: Record<string, unknown> = {}
  if (patch.role !== undefined) update.role = patch.role
  if (patch.fullName !== undefined) update.full_name = patch.fullName

  const { data, error } = await db(supabase)
    .from('team_admins')
    .update(update)
    .eq('id', adminId)
    .select()
    .single()

  if (error) {
    if ((error as { code?: string }).code === 'PGRST116') {
      throw new TeamError('TEAM_ADMIN_NOT_FOUND', 'Administrator not found')
    }
    throw new TeamError('TEAM_ADMIN_UPDATE_FAILED', (error as { message: string }).message)
  }

  return data as TeamAdmin
}

/**
 * PM-14 / WS-PROFILE-02: re-issue an invite for an already-invited admin.
 *
 * The old path re-ran `inviteTeamAdmin`, a plain INSERT that violates the
 * `team_admins_team_email_unique (team_id, invited_email)` index — the write
 * failed every time while the UI still toasted "Invite resent." Upsert on that
 * unique key instead: it finds the existing pending row and refreshes it (and,
 * were the row somehow missing, recreates it) rather than colliding. Returns the
 * live row so the caller can trigger the invite email off a real success.
 */
export async function resendTeamAdminInvite(
  supabase: SupabaseClient<Database>,
  teamId: string,
  invitedBy: string,
  invite: { email: string; role?: TeamAdminRole; fullName?: string }
): Promise<TeamAdmin> {
  const { data, error } = await db(supabase)
    .from('team_admins')
    .upsert(
      {
        team_id: teamId,
        invited_by: invitedBy,
        invited_email: invite.email,
        role: invite.role ?? 'standard',
        full_name: invite.fullName ?? null,
        invite_status: 'invited',
        invited_at: new Date().toISOString(),
      },
      { onConflict: 'team_id,invited_email' }
    )
    .select()
    .single()

  if (error) {
    throw new TeamError('TEAM_ADMIN_RESEND_FAILED', (error as { message: string }).message)
  }

  return data as TeamAdmin
}

export async function removeTeamAdmin(
  supabase: SupabaseClient<Database>,
  adminId: string
): Promise<void> {
  // RLS restricts this to the owning team's primary admin.
  const { error } = await db(supabase)
    .from('team_admins')
    .delete()
    .eq('id', adminId)

  if (error) {
    throw new TeamError('TEAM_ADMIN_REMOVE_FAILED', (error as { message: string }).message)
  }
}
