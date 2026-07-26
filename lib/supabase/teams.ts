import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import { db } from '@/lib/supabase/typed-client'

type TeamProfileRow = Database['public']['Tables']['team_profiles']['Row']
type TeamProfileInsert = Database['public']['Tables']['team_profiles']['Insert']
type TeamAdminRow = Database['public']['Tables']['team_admins']['Row']
type TeamAdminRole = Database['public']['Enums']['team_admin_role']

export type TeamProfile = TeamProfileRow
export type TeamAdmin = TeamAdminRow

// Columns the caller must never set on profile creation — identity / audit columns
// are managed by the DB and triggers.
const PROTECTED_TEAM_FIELDS = new Set<string>([
  'id',
  'user_id',
  'created_at',
  'updated_at',
  'status',
])

function sanitizeTeamData(
  data: Record<string, unknown>
): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(data).filter(([key, value]) => {
      if (PROTECTED_TEAM_FIELDS.has(key)) return false
      if (value === '') return false
      return true
    })
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

  const { data: row, error } = await db(supabase)
    .from('team_profiles')
    .insert({ ...clean, user_id: userId })
    .select()
    .single()

  if (error) {
    throw new TeamError('TEAM_PROFILE_CREATE_FAILED', (error as { message: string }).message)
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
