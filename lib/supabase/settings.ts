import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

type ProfileSettingsRow = Database['public']['Tables']['profile_settings']['Row']
type ProfileSettingsUpdate = Database['public']['Tables']['profile_settings']['Update']
type ActiveSessionRow = Database['public']['Tables']['active_sessions']['Row']
type LoginHistoryRow = Database['public']['Tables']['login_history']['Row']
type DataExportRow = Database['public']['Tables']['data_export_requests']['Row']

export type ProfileSettings = ProfileSettingsRow

// Columns that must never be patched directly by a settings update — identity and
// audit columns are managed by the DB / triggers, never by the user.
const PROTECTED_SETTINGS_FIELDS = new Set<string>([
  'id',
  'user_id',
  'created_at',
  'updated_at',
])

function sanitizeSettingsPatch(
  patch: Record<string, unknown>
): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(patch).filter(([key]) => !PROTECTED_SETTINGS_FIELDS.has(key))
  )
}

export class SettingsError extends Error {
  constructor(
    public readonly code: string,
    message: string
  ) {
    super(message)
    this.name = 'SettingsError'
  }
}

// ---------------------------------------------------------------------------
// Profile settings
// ---------------------------------------------------------------------------

export async function getSettings(
  supabase: SupabaseClient<Database>,
  userId: string
): Promise<ProfileSettings> {
  // as SupabaseClient: strips the Database generic to avoid deep PostgREST chain type inference
  const { data, error } = await (supabase as SupabaseClient)
    .from('profile_settings')
    .select('*')
    .eq('user_id', userId)
    .single()

  if (error) {
    throw new SettingsError('SETTINGS_FETCH_FAILED', (error as { message: string }).message)
  }

  return data as ProfileSettings
}

export async function updateSettings(
  supabase: SupabaseClient<Database>,
  userId: string,
  patch: ProfileSettingsUpdate
): Promise<ProfileSettings> {
  const clean = sanitizeSettingsPatch(patch as Record<string, unknown>)

  // as SupabaseClient: strips the Database generic to avoid deep PostgREST chain type inference
  const { data, error } = await (supabase as SupabaseClient)
    .from('profile_settings')
    .update(clean)
    .eq('user_id', userId)
    .select()
    .single()

  if (error) {
    if ((error as { code?: string }).code === 'PGRST116') {
      throw new SettingsError('SETTINGS_NOT_FOUND', 'Settings not found for this user')
    }
    throw new SettingsError('SETTINGS_UPDATE_FAILED', (error as { message: string }).message)
  }

  return data as ProfileSettings
}

// ---------------------------------------------------------------------------
// Active sessions
// ---------------------------------------------------------------------------

export async function getActiveSessions(
  supabase: SupabaseClient<Database>,
  userId: string
): Promise<ActiveSessionRow[]> {
  // as SupabaseClient: strips the Database generic to avoid deep PostgREST chain type inference
  const { data, error } = await (supabase as SupabaseClient)
    .from('active_sessions')
    .select('*')
    .eq('user_id', userId)
    .order('last_active_at', { ascending: false })

  if (error) {
    throw new SettingsError('SESSIONS_FETCH_FAILED', (error as { message: string }).message)
  }

  return (data ?? []) as ActiveSessionRow[]
}

export async function revokeSession(
  supabase: SupabaseClient<Database>,
  sessionId: string
): Promise<void> {
  // RLS restricts deletes to the owning user; we never pass user_id here.
  // as SupabaseClient: strips the Database generic to avoid deep PostgREST chain type inference
  const { error } = await (supabase as SupabaseClient)
    .from('active_sessions')
    .delete()
    .eq('id', sessionId)

  if (error) {
    throw new SettingsError('SESSION_REVOKE_FAILED', (error as { message: string }).message)
  }
}

// ---------------------------------------------------------------------------
// Login history
// ---------------------------------------------------------------------------

export async function getLoginHistory(
  supabase: SupabaseClient<Database>,
  userId: string
): Promise<LoginHistoryRow[]> {
  // as SupabaseClient: strips the Database generic to avoid deep PostgREST chain type inference
  const { data, error } = await (supabase as SupabaseClient)
    .from('login_history')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })

  if (error) {
    throw new SettingsError('LOGIN_HISTORY_FETCH_FAILED', (error as { message: string }).message)
  }

  return (data ?? []) as LoginHistoryRow[]
}

// ---------------------------------------------------------------------------
// GDPR data export
// ---------------------------------------------------------------------------

export async function requestDataExport(
  supabase: SupabaseClient<Database>,
  userId: string
): Promise<DataExportRow> {
  // Creates a pending export request; a background job fulfils it and sets the
  // 72h-expiring download_url. Status defaults to 'pending' at the DB level.
  // as SupabaseClient: strips the Database generic to avoid deep PostgREST chain type inference
  const { data, error } = await (supabase as SupabaseClient)
    .from('data_export_requests')
    .insert({ user_id: userId })
    .select()
    .single()

  if (error) {
    throw new SettingsError('DATA_EXPORT_REQUEST_FAILED', (error as { message: string }).message)
  }

  return data as DataExportRow
}
