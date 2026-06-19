import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import { createNotification } from '@/lib/supabase/notifications'

/**
 * Notification dispatch scaffolding (spec §7).
 *
 * A single domain event ("connection request received", "payment received") may
 * fan out to several channels (in-app, email, push). This module owns that
 * fan-out: it normalises the request, then persists one `notification_logs` row
 * per channel via the existing `createNotification` query (admin/service-role
 * client only — RLS blocks user inserts). Channel-specific delivery (email/push
 * transports) is layered on later; persisting the log is the durable record.
 */

type NotificationChannel = Database['public']['Enums']['notification_channel']
type NotificationLogRow = Database['public']['Tables']['notification_logs']['Row']

export class NotificationDispatchError extends Error {
  constructor(
    public readonly code: string,
    message: string
  ) {
    super(message)
    this.name = 'NotificationDispatchError'
  }
}

export interface DispatchRequest {
  userId: string
  eventType: string
  title: string
  body: string
  /** Defaults to `['in_app']` when omitted. */
  channels?: NotificationChannel[]
  metadata?: Record<string, unknown>
}

export async function dispatchNotification(
  adminSupabase: SupabaseClient<Database>,
  req: DispatchRequest
): Promise<NotificationLogRow[]> {
  if (!req.userId) {
    throw new NotificationDispatchError('INVALID_USER', 'userId is required')
  }
  if (!req.title.trim() || !req.body.trim()) {
    throw new NotificationDispatchError(
      'INVALID_CONTENT',
      'Notification title and body are required'
    )
  }

  const channels = req.channels?.length ? req.channels : (['in_app'] as NotificationChannel[])

  try {
    return await Promise.all(
      channels.map((channel) =>
        createNotification(adminSupabase, {
          user_id: req.userId,
          event_type: req.eventType,
          channel,
          title: req.title,
          body: req.body,
          // metadata is jsonb (Json); req.metadata is a plain record — coerce to Json
          metadata: (req.metadata ?? {}) as Database['public']['Tables']['notification_logs']['Row']['metadata'],
        })
      )
    )
  } catch (err) {
    throw new NotificationDispatchError(
      'DISPATCH_FAILED',
      err instanceof Error ? err.message : 'Notification dispatch failed'
    )
  }
}
