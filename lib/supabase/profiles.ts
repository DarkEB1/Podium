import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

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

function sanitizeProfileData(data: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(data).filter(([key]) => !PROTECTED_FIELDS.has(key)))
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
  const { data: profile, error } = await (supabase as SupabaseClient)
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
  const { data, error } = await (supabase as SupabaseClient)
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
  const safe = sanitizeProfileData(data)
  const { data: profile, error } = await (supabase as SupabaseClient)
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
  const { error } = await (supabase as SupabaseClient)
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

export async function getPublicProfile(
  supabase: SupabaseClient<Database>,
  targetUserId: string,
  role: ProfileRole
): Promise<ProfileRow | null> {
  const table = TABLE_FOR_ROLE[role]
  const { data, error } = await (supabase as SupabaseClient)
    .from(table)
    .select('*')
    .eq('user_id', targetUserId)
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
  const { data, error } = await (supabase as SupabaseClient)
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

  const { error } = await (supabase as SupabaseClient)
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
  const { data, error } = await (supabase as SupabaseClient)
    .from('representation_links')
    .select('*')
    .eq('client_user_id', clientUserId)

  if (error) {
    throw new ProfileError('LINKS_FETCH_FAILED', (error as { message: string }).message)
  }

  return (data ?? []) as RepLinkRow[]
}
