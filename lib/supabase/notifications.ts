import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import { db } from '@/lib/supabase/typed-client'

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
  // WS-MSG-14: the bell is the in-app surface only. A single domain event fans
  // out to several notification_logs rows (in_app + email + push), so without
  // this filter the bell would show — and count as unread — the email and push
  // copies of every event alongside the in-app one.
  const { data, error } = await db(supabase)
    .from('notification_logs')
    .select('*')
    .eq('user_id', userId)
    .eq('channel', 'in_app')
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

  const { data, error } = await db(adminSupabase)
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
  const { data, error } = await db(adminSupabase)
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
