import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import { db } from '@/lib/supabase/typed-client'
import {
  type CookiePreferences,
  parseCookiePreferences,
} from '@/lib/legal/cookie-consent'

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

/**
 * The row a user gets when their account is created: every column at its DB
 * default (migration 20260616000003). Mirrored here so a read can answer with
 * the same values the database would have, rather than failing.
 *
 * `id` is empty and the timestamps are null on purpose: this value was never
 * persisted, and nothing should mistake it for a stored row.
 */
function defaultSettings(userId: string): ProfileSettings {
  // as ProfileSettings: id/created_at/updated_at are non-null on a stored row,
  // but this synthetic value is explicitly not one — see above.
  return {
    id: '',
    user_id: userId,
    notification_matrix: {},
    quiet_hours_start: null,
    quiet_hours_end: null,
    email_digest: 'off',
    marketing_opt_in: false,
    profile_visible: true,
    discoverable: true,
    section_visibility: {},
    location_precision: 'city',
    pause_matches: false,
    display_currency: 'gbp',
    created_at: null,
    updated_at: null,
  } as unknown as ProfileSettings
}

/**
 * The user's settings, or the defaults if no row has been written yet.
 *
 * QA-1.5: this used `.single()`, which throws when there is no row, and nothing
 * in the product ever created one. Every transactional email checks preferences
 * through here (sendTransactionalEmail -> emailAllowed -> getSettings), so the
 * throw meant no email had ever been sent to anyone, for any event. The email
 * layer swallows its own errors by design so a mail problem cannot roll back the
 * connection request or proposal that triggered it, which is exactly why this
 * went unnoticed.
 *
 * Migration 20260730000300 makes the row exist for everyone from now on. This
 * fallback is the other half: a preference read is not the place to fail, and
 * defaults are the correct answer for a user who has never expressed one.
 */
export async function getSettings(
  supabase: SupabaseClient<Database>,
  userId: string
): Promise<ProfileSettings> {
  const { data, error } = await db(supabase)
    .from('profile_settings')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle()

  if (error) {
    throw new SettingsError('SETTINGS_FETCH_FAILED', (error as { message: string }).message)
  }

  return (data as ProfileSettings | null) ?? defaultSettings(userId)
}

export async function updateSettings(
  supabase: SupabaseClient<Database>,
  userId: string,
  patch: ProfileSettingsUpdate
): Promise<ProfileSettings> {
  const clean = sanitizeSettingsPatch(patch as Record<string, unknown>)

  const { data, error } = await db(supabase)
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
  const { data, error } = await db(supabase)
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
  const { error } = await db(supabase)
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
  const { data, error } = await db(supabase)
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
// Notification preferences (CL-4)
// ---------------------------------------------------------------------------

/**
 * Per-event, per-channel notification matrix, e.g.
 *   { "new_match": { "push": true, "in_app": true, "email": false } }
 * Stored in `profile_settings.notification_matrix` (jsonb).
 */
export type NotificationMatrix = Record<
  string,
  Partial<Record<'push' | 'email' | 'in_app', boolean>>
>

/**
 * Reads the user's notification matrix. This is the surface a
 * "manage notification preferences" page (and any future email unsubscribe
 * link) must read from — there is no separate email preference store.
 */
export async function getNotificationMatrix(
  supabase: SupabaseClient<Database>,
  userId: string
): Promise<NotificationMatrix> {
  const settings = await getSettings(supabase, userId)
  const raw = settings.notification_matrix
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return {}
  // as NotificationMatrix: the column is untyped `Json`; shape is app-validated.
  return raw as NotificationMatrix
}

/**
 * Merges a patch into the notification matrix (per-event, per-channel) and
 * persists it. Merging rather than replacing means a single toggle cannot wipe
 * the rest of the user's preferences.
 */
export async function updateNotificationMatrix(
  supabase: SupabaseClient<Database>,
  userId: string,
  patch: NotificationMatrix
): Promise<NotificationMatrix> {
  const current = await getNotificationMatrix(supabase, userId)

  const merged: NotificationMatrix = { ...current }
  for (const [event, channels] of Object.entries(patch)) {
    merged[event] = { ...(current[event] ?? {}), ...channels }
  }

  const updated = await updateSettings(supabase, userId, {
    notification_matrix: merged,
  })

  const raw = updated.notification_matrix
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return {}
  // as NotificationMatrix: the column is untyped `Json`; shape is app-validated.
  return raw as NotificationMatrix
}

/**
 * Turns off every email channel in one call — the operation an unsubscribe
 * link must perform once an email provider is integrated. Also clears the
 * marketing opt-in, because an unsubscribe covers marketing absolutely
 * (UK GDPR Art. 21(2) / PECR).
 */
export async function unsubscribeFromAllEmail(
  supabase: SupabaseClient<Database>,
  userId: string
): Promise<void> {
  const current = await getNotificationMatrix(supabase, userId)

  const cleared: NotificationMatrix = {}
  for (const [event, channels] of Object.entries(current)) {
    cleared[event] = { ...channels, email: false }
  }

  await updateSettings(supabase, userId, {
    notification_matrix: cleared,
    email_digest: 'off',
    marketing_opt_in: false,
  })
}

// ---------------------------------------------------------------------------
// Cookie consent (M-7 / CL-2)
// ---------------------------------------------------------------------------

/**
 * Reads the durable copy of the user's cookie choice from `users.cookie_prefs`.
 * Returns null when no valid choice has been recorded — never a default that
 * could be mistaken for consent.
 */
export async function getCookiePrefs(
  supabase: SupabaseClient<Database>,
  userId: string
): Promise<CookiePreferences | null> {
  const { data, error } = await db(supabase)
    .from('users')
    .select('cookie_prefs')
    .eq('id', userId)
    .single()

  if (error) {
    throw new SettingsError('COOKIE_PREFS_FETCH_FAILED', (error as { message: string }).message)
  }

  return parseCookiePreferences((data as { cookie_prefs?: unknown } | null)?.cookie_prefs)
}

/** Writes the user's cookie choice to `users.cookie_prefs`. */
export async function updateCookiePrefs(
  supabase: SupabaseClient<Database>,
  userId: string,
  prefs: CookiePreferences
): Promise<CookiePreferences> {
  const { error } = await db(supabase)
    .from('users')
    .update({ cookie_prefs: prefs })
    .eq('id', userId)

  if (error) {
    throw new SettingsError('COOKIE_PREFS_UPDATE_FAILED', (error as { message: string }).message)
  }

  return prefs
}

/**
 * Convenience wrapper for the consent banner: resolves the current session and
 * mirrors the choice to the account, or reports that nobody is signed in.
 *
 * Exists so the banner never has to call `supabase.auth`/PostgREST itself —
 * every Supabase call stays inside lib/supabase (CLAUDE.md). Returns false for
 * a signed-out visitor, whose choice lives only in the first-party cookie.
 */
export async function saveCookiePrefsForCurrentUser(
  supabase: SupabaseClient<Database>,
  prefs: CookiePreferences
): Promise<boolean> {
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return false

  await updateCookiePrefs(supabase, user.id, prefs)
  return true
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
  const { data, error } = await db(supabase)
    .from('data_export_requests')
    .insert({ user_id: userId })
    .select()
    .single()

  if (error) {
    throw new SettingsError('DATA_EXPORT_REQUEST_FAILED', (error as { message: string }).message)
  }

  return data as DataExportRow
}
