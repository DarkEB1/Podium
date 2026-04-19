import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

type UserRow = Database['public']['Tables']['users']['Row']
type ValidRole = 'athlete' | 'team' | 'brand' | 'agent'

export interface PasswordValidationResult {
  valid: boolean
  error?: string
}

export function validatePassword(password: string): PasswordValidationResult {
  if (password.length < 8) {
    return { valid: false, error: 'Password must be at least 8 characters' }
  }
  if (!/[A-Z]/.test(password)) {
    return { valid: false, error: 'Password must contain at least one uppercase letter' }
  }
  if (!/[0-9]/.test(password)) {
    return { valid: false, error: 'Password must contain at least one number' }
  }
  if (!/[^A-Za-z0-9]/.test(password)) {
    return { valid: false, error: 'Password must contain at least one symbol' }
  }
  return { valid: true }
}

export class AuthError extends Error {
  constructor(
    public readonly code: string,
    message: string
  ) {
    super(message)
    this.name = 'AuthError'
  }
}

export async function getUser(
  supabase: SupabaseClient<Database>
): Promise<UserRow | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return null

  const { data } = await supabase
    .from('users')
    .select('*')
    .eq('id', user.id)
    .single()

  return data
}

export async function lockRole(
  supabase: SupabaseClient<Database>,
  userId: string,
  role: ValidRole
): Promise<void> {
  const { data } = await supabase
    .from('users')
    .select('role_locked_at')
    .eq('id', userId)
    .single()

  if (data?.role_locked_at) {
    throw new AuthError(
      'ROLE_ALREADY_LOCKED',
      'Role has already been set and cannot be changed'
    )
  }

  const { error } = await supabase
    .from('users')
    .update({ role, role_locked_at: new Date().toISOString() })
    .eq('id', userId)

  if (error) {
    throw new AuthError('ROLE_UPDATE_FAILED', error.message)
  }
}

export async function acceptTerms(
  supabase: SupabaseClient<Database>,
  userId: string,
  tcVersion: string,
  ppVersion: string
): Promise<void> {
  const now = new Date().toISOString()
  const { error } = await supabase
    .from('users')
    .update({
      terms_accepted_at: now,
      terms_version: tcVersion,
      privacy_accepted_at: now,
      privacy_version: ppVersion,
    })
    .eq('id', userId)

  if (error) {
    throw new AuthError('TERMS_UPDATE_FAILED', error.message)
  }
}

export async function requestDeletion(
  supabase: SupabaseClient<Database>,
  userId: string
): Promise<void> {
  const now = new Date()
  const scheduledAt = new Date(now)
  scheduledAt.setDate(scheduledAt.getDate() + 14)

  const { error } = await supabase
    .from('users')
    .update({
      deletion_requested_at: now.toISOString(),
      deletion_scheduled_at: scheduledAt.toISOString(),
    })
    .eq('id', userId)

  if (error) {
    throw new AuthError('DELETION_REQUEST_FAILED', error.message)
  }
}
