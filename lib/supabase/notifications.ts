import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

type NotificationLogRow = Database['public']['Tables']['notification_logs']['Row']
type NotificationLogInsert = Database['public']['Tables']['notification_logs']['Insert']

export class NotificationsError extends Error {
  constructor(
    public readonly code: string,
    message: string
  ) {
    super(message)
    this.name = 'NotificationsError'
  }
}

export async function getNotifications(
  supabase: SupabaseClient<Database>,
  userId: string
): Promise<NotificationLogRow[]> {
  // as SupabaseClient: strips the Database generic to avoid deep PostgREST chain type inference
  const { data, error } = await (supabase as SupabaseClient)
    .from('notification_logs')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })

  if (error) {
    throw new NotificationsError(
      'NOTIFICATIONS_FETCH_FAILED',
      (error as { message: string }).message
    )
  }

  return (data ?? []) as NotificationLogRow[]
}

export async function markRead(
  // markRead uses admin client + explicit userId filter: no UPDATE RLS policy on notification_logs
  adminSupabase: SupabaseClient<Database>,
  notificationId: string,
  userId: string
): Promise<NotificationLogRow> {
  const now = new Date().toISOString()

  // as SupabaseClient: strips the Database generic to avoid deep PostgREST chain type inference
  const { data, error } = await (adminSupabase as SupabaseClient)
    .from('notification_logs')
    .update({ read_at: now })
    .eq('id', notificationId)
    .eq('user_id', userId)
    .select()
    .single()

  if (error) {
    if ((error as { code?: string }).code === 'PGRST116') {
      throw new NotificationsError('NOTIFICATION_NOT_FOUND', 'Notification not found or not owned')
    }
    throw new NotificationsError(
      'NOTIFICATION_UPDATE_FAILED',
      (error as { message: string }).message
    )
  }

  return data as NotificationLogRow
}

export async function createNotification(
  adminSupabase: SupabaseClient<Database>,
  payload: Omit<NotificationLogInsert, 'id' | 'created_at' | 'sent_at'>
): Promise<NotificationLogRow> {
  // createNotification requires service-role client — RLS blocks user client inserts
  // as SupabaseClient: strips the Database generic to avoid deep PostgREST chain type inference
  const { data, error } = await (adminSupabase as SupabaseClient)
    .from('notification_logs')
    .insert(payload)
    .select()
    .single()

  if (error) {
    throw new NotificationsError(
      'NOTIFICATION_CREATE_FAILED',
      (error as { message: string }).message
    )
  }

  return data as NotificationLogRow
}
