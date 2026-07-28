import { createHash } from 'crypto'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

/**
 * Active sessions and login history (spec §privacy/security).
 *
 * These tables existed but nothing wrote to them. This module is the writer
 * (called from the auth routes) and reader (the account security page).
 *
 * The session identifier is a SHA-256 of the Supabase refresh token, so the
 * table can be joined to a live session and revoked, without ever storing the
 * token itself. Writes use the service-role admin client; reads use the user's
 * client (RLS allows a user to see only their own rows).
 */

export type ActiveSessionRow = Database['public']['Tables']['active_sessions']['Row']
export type LoginHistoryRow = Database['public']['Tables']['login_history']['Row']

export function sessionTokenHash(refreshToken: string): string {
  return createHash('sha256').update(refreshToken).digest('hex')
}

/** A coarse "Browser on OS" label from a user-agent string. */
export function deviceLabel(userAgent: string | null | undefined): string {
  const ua = userAgent ?? ''
  const browser = /Edg\//.test(ua)
    ? 'Edge'
    : /OPR\//.test(ua)
      ? 'Opera'
      : /Chrome\//.test(ua)
        ? 'Chrome'
        : /Firefox\//.test(ua)
          ? 'Firefox'
          : /Safari\//.test(ua)
            ? 'Safari'
            : 'Browser'
  const os = /Windows/.test(ua)
    ? 'Windows'
    : /Mac OS X|Macintosh/.test(ua)
      ? 'macOS'
      : /Android/.test(ua)
        ? 'Android'
        : /iPhone|iPad|iOS/.test(ua)
          ? 'iOS'
          : /Linux/.test(ua)
            ? 'Linux'
            : 'Unknown OS'
  return `${browser} on ${os}`
}

interface Context {
  ip?: string | null
  userAgent?: string | null
}

/** Record a successful sign-in and upsert its active session. Best-effort. */
export async function recordLogin(
  admin: SupabaseClient<Database>,
  userId: string,
  ctx: Context & { refreshToken?: string | null }
): Promise<void> {
  const client = admin as SupabaseClient
  await client.from('login_history').insert({
    user_id: userId,
    success: true,
    ip_address: ctx.ip ?? null,
    user_agent: ctx.userAgent ?? null,
  })

  if (ctx.refreshToken) {
    await client.from('active_sessions').upsert(
      {
        user_id: userId,
        session_token: sessionTokenHash(ctx.refreshToken),
        ip_address: ctx.ip ?? null,
        user_agent: ctx.userAgent ?? null,
        device_label: deviceLabel(ctx.userAgent),
        last_active_at: new Date().toISOString(),
      },
      { onConflict: 'session_token' }
    )
  }
}

/** Record a failed sign-in for a known user (powers "someone tried to sign in"). */
export async function recordFailedLogin(
  admin: SupabaseClient<Database>,
  userId: string,
  ctx: Context
): Promise<void> {
  await (admin as SupabaseClient).from('login_history').insert({
    user_id: userId,
    success: false,
    ip_address: ctx.ip ?? null,
    user_agent: ctx.userAgent ?? null,
  })
}

/** Resolve a user id from an email, for attributing a failed login. */
export async function findUserIdByEmail(
  admin: SupabaseClient<Database>,
  email: string
): Promise<string | null> {
  const { data } = await (admin as SupabaseClient)
    .from('users')
    .select('id')
    .eq('email', email.toLowerCase())
    .maybeSingle()
  return (data as { id?: string } | null)?.id ?? null
}

export async function listActiveSessions(
  supabase: SupabaseClient<Database>,
  userId: string
): Promise<ActiveSessionRow[]> {
  const { data } = await (supabase as SupabaseClient)
    .from('active_sessions')
    .select('*')
    .eq('user_id', userId)
    .order('last_active_at', { ascending: false })
  return (data as ActiveSessionRow[] | null) ?? []
}

export async function listLoginHistory(
  supabase: SupabaseClient<Database>,
  userId: string,
  limit = 10
): Promise<LoginHistoryRow[]> {
  const { data } = await (supabase as SupabaseClient)
    .from('login_history')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit)
  return (data as LoginHistoryRow[] | null) ?? []
}

/** Revoke one of the caller's sessions (removes it from the active list). */
export async function revokeSession(
  admin: SupabaseClient<Database>,
  userId: string,
  sessionId: string
): Promise<void> {
  await (admin as SupabaseClient)
    .from('active_sessions')
    .delete()
    .eq('id', sessionId)
    .eq('user_id', userId)
}

/** Remove the active-session row for the current session (called on sign-out). */
export async function clearSession(
  admin: SupabaseClient<Database>,
  userId: string,
  refreshToken: string
): Promise<void> {
  await (admin as SupabaseClient)
    .from('active_sessions')
    .delete()
    .eq('user_id', userId)
    .eq('session_token', sessionTokenHash(refreshToken))
}
