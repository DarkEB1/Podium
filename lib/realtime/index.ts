import type { RealtimeChannel, SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

/**
 * Realtime scaffolding for the messaging chat view (spec §7.2).
 *
 * Typing indicators and read receipts are *ephemeral* signals — the `messages`
 * table has no `read_at` column — so they are exchanged over Supabase Realtime
 * `broadcast` events rather than persisted rows. Presence drives the online dot.
 *
 * Consumers (MS2 `chat-window.tsx`) open the channel, subscribe via the helpers
 * below, and call `closeChannel` on unmount.
 */

export class RealtimeError extends Error {
  constructor(
    public readonly code: string,
    message: string
  ) {
    super(message)
    this.name = 'RealtimeError'
  }
}

export const TYPING_EVENT = 'typing' as const
export const READ_RECEIPT_EVENT = 'read_receipt' as const

export interface TypingPayload {
  userId: string
  isTyping: boolean
}

export interface ReadReceiptPayload {
  userId: string
  lastReadMessageId: string
  readAt: string
}

export interface PresenceMeta {
  userId: string
  onlineAt: string
}

export type PresenceState = Record<string, PresenceMeta[]>

// ---------------------------------------------------------------------------
// Channel factories
// ---------------------------------------------------------------------------

/** Broadcast channel for typing + read-receipt signals, scoped to one match. */
export function typingChannel(
  supabase: SupabaseClient<Database>,
  matchId: string
): RealtimeChannel {
  if (!matchId) {
    throw new RealtimeError('INVALID_MATCH_ID', 'matchId is required to open a typing channel')
  }
  return supabase.channel(`typing:${matchId}`)
}

/** Presence channel keyed by the current user, scoped to one match. */
export function presenceChannel(
  supabase: SupabaseClient<Database>,
  matchId: string,
  userId: string
): RealtimeChannel {
  if (!matchId || !userId) {
    throw new RealtimeError(
      'INVALID_PRESENCE_ARGS',
      'matchId and userId are required to open a presence channel'
    )
  }
  return supabase.channel(`presence:${matchId}`, {
    config: { presence: { key: userId } },
  })
}

// ---------------------------------------------------------------------------
// Typing indicator
// ---------------------------------------------------------------------------

export async function sendTyping(
  channel: RealtimeChannel,
  userId: string,
  isTyping: boolean
): Promise<void> {
  await channel.send({
    type: 'broadcast',
    event: TYPING_EVENT,
    payload: { userId, isTyping } satisfies TypingPayload,
  })
}

export function onTyping(
  channel: RealtimeChannel,
  cb: (payload: TypingPayload) => void
): RealtimeChannel {
  // The broadcast handler signature is not generic on the @supabase/supabase-js
  // RealtimeChannel overloads; cast the wrapper to the accepted shape.
  const handler = (msg: { payload: TypingPayload }) => cb(msg.payload)
  return channel.on('broadcast', { event: TYPING_EVENT }, handler as never)
}

// ---------------------------------------------------------------------------
// Read receipts (single/double tick — spec §7.2)
// ---------------------------------------------------------------------------

export async function sendReadReceipt(
  channel: RealtimeChannel,
  userId: string,
  lastReadMessageId: string,
  readAt: string
): Promise<void> {
  await channel.send({
    type: 'broadcast',
    event: READ_RECEIPT_EVENT,
    payload: { userId, lastReadMessageId, readAt } satisfies ReadReceiptPayload,
  })
}

export function onReadReceipt(
  channel: RealtimeChannel,
  cb: (payload: ReadReceiptPayload) => void
): RealtimeChannel {
  const handler = (msg: { payload: ReadReceiptPayload }) => cb(msg.payload)
  return channel.on('broadcast', { event: READ_RECEIPT_EVENT }, handler as never)
}

// ---------------------------------------------------------------------------
// Presence
// ---------------------------------------------------------------------------

export async function trackPresence(
  channel: RealtimeChannel,
  meta: PresenceMeta
): Promise<void> {
  await channel.track(meta)
}

export function onPresenceSync(
  channel: RealtimeChannel,
  cb: (state: PresenceState) => void
): RealtimeChannel {
  return channel.on('presence', { event: 'sync' }, () => {
    cb(channel.presenceState() as unknown as PresenceState)
  })
}

/** Unsubscribe + remove the channel; call on component unmount. */
export async function closeChannel(
  supabase: SupabaseClient<Database>,
  channel: RealtimeChannel
): Promise<void> {
  await supabase.removeChannel(channel)
}
