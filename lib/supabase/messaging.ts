import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import { db } from '@/lib/supabase/typed-client'

type MessageRow = Database['public']['Tables']['messages']['Row']
type MatchRow = Database['public']['Tables']['matches']['Row']

export class MessagingError extends Error {
  constructor(
    public readonly code: string,
    message: string
  ) {
    super(message)
    this.name = 'MessagingError'
  }
}

export interface MessagePayload {
  text_content?: string
  attachment_url?: string
  attachment_size_bytes?: number
  attachment_mime_type?: string
  metadata?: Record<string, unknown>
}

// ---------------------------------------------------------------------------
// Matches
// ---------------------------------------------------------------------------

export async function getMatches(
  supabase: SupabaseClient<Database>,
  userId: string
): Promise<MatchRow[]> {
  const { data, error } = await db(supabase)
    .from('matches')
    .select('*')
    .or(`user_a_id.eq.${userId},user_b_id.eq.${userId}`)
    .eq('status', 'active')

  if (error) {
    throw new MessagingError('MATCHES_FETCH_FAILED', (error as { message: string }).message)
  }

  return (data ?? []) as MatchRow[]
}

/**
 * Fetch a single match by id (RLS scopes it to a participant), or null when the
 * caller cannot see it. Used to resolve the OTHER participant's id for the chat
 * Block control (WS-MSG-05) without leaking it through the message rows.
 */
export async function getMatch(
  supabase: SupabaseClient<Database>,
  matchId: string
): Promise<MatchRow | null> {
  const { data, error } = await db(supabase)
    .from('matches')
    .select('*')
    .eq('id', matchId)
    .single()

  if (error) {
    if ((error as { code?: string }).code === 'PGRST116') return null
    throw new MessagingError('MATCH_FETCH_FAILED', (error as { message: string }).message)
  }

  return data as MatchRow
}

/** The other participant of a match, from the current user's perspective. */
export function otherParticipantId(match: MatchRow, currentUserId: string): string {
  return match.user_a_id === currentUserId ? match.user_b_id : match.user_a_id
}

/**
 * Inbox view-model row consumed by the MS1 `MatchList` component (spec §7.1).
 * Mirrors `components/messaging/match-list.tsx` `Conversation`.
 */
export interface Conversation {
  id: string
  name: string
  avatarUrl: string | null
  preview: string
  timestamp: string
  unreadCount: number
}

/**
 * One row of `public.get_conversations()`
 * (supabase/migrations/20260720001004_inbox_and_message_reads.sql).
 */
interface InboxRow {
  match_id: string
  other_user_id: string
  display_name: string | null
  avatar_url: string | null
  last_message_text: string | null
  last_message_type: string | null
  last_message_at: string | null
  matched_at: string
  unread_count: number
  /** 'active' | 'archived'. Added by SEC-9; absent on a pre-SEC-9 database. */
  match_status?: string | null
}

export interface GetConversationsOptions {
  /**
   * Include archived matches. Archiving is documented as reversible (DI-3) but
   * the inbox RPC used to hard-filter status = 'active', which made an archived
   * conversation impossible to find and therefore impossible to un-archive.
   */
  includeArchived?: boolean
}

/** Human preview line for the inbox, derived from the last message. */
function previewFor(row: InboxRow): string {
  if (!row.last_message_type) return 'No messages yet'
  if (row.last_message_type === 'proposal_card') return 'Sent a proposal'
  if (row.last_message_type === 'payment_confirmation') return 'Payment confirmed'
  return row.last_message_text ?? 'Attachment'
}

/**
 * Build the inbox `Conversation[]` view-model for a user (spec §7.1).
 *
 * SB-3/L-3: this used to run ~5 queries PER conversation (four profile-table
 * probes to resolve the counterparty, plus a last-message lookup) and hardcoded
 * `unreadCount` to 0. It is now a SINGLE `get_conversations()` RPC that resolves
 * names/avatars, the last non-deleted message and the real unread count (based
 * on the `message_reads` watermark) server-side.
 *
 * `_userId` is no longer needed for scoping — the RPC scopes to `auth.uid()` —
 * but the parameter is kept so existing call sites keep compiling.
 */
export async function getConversations(
  supabase: SupabaseClient<Database>,
  _userId: string,
  options: GetConversationsOptions = {}
): Promise<Conversation[]> {
  // Deliberately unused: scoping is done server-side from auth.uid().
  void _userId

  // the generated Functions map, which would otherwise reject the rpc name.
  const { data, error } = await db(supabase).rpc('get_conversations', {
    p_include_archived: options.includeArchived ?? false,
  })

  if (error) {
    throw new MessagingError(
      'CONVERSATIONS_FETCH_FAILED',
      (error as { message: string }).message
    )
  }

  // as InboxRow[]: the RPC's SETOF return type is not in the generated types
  const rows = (data ?? []) as InboxRow[]

  return rows.map((row) => ({
    id: row.match_id,
    name: row.display_name ?? 'Conversation',
    avatarUrl: row.avatar_url,
    preview: previewFor(row),
    timestamp: row.last_message_at ?? row.matched_at,
    unreadCount: row.unread_count ?? 0,
  }))
}

/**
 * Move the caller's read watermark on a match to now, zeroing its unread count
 * on the next `getConversations()` call (L-3).
 */
export async function markMatchRead(
  supabase: SupabaseClient<Database>,
  matchId: string
): Promise<void> {
  // the generated Functions map, which would otherwise reject the rpc name.
  const { error } = await db(supabase).rpc('mark_match_read', {
    p_match_id: matchId,
  })

  if (error) {
    throw new MessagingError('MARK_READ_FAILED', (error as { message: string }).message)
  }
}

// ---------------------------------------------------------------------------
// Messages
// ---------------------------------------------------------------------------

export async function sendMessage(
  supabase: SupabaseClient<Database>,
  matchId: string,
  senderId: string,
  contentType: Database['public']['Enums']['message_type'],
  payload: MessagePayload
): Promise<MessageRow> {
  const { data: match, error: matchError } = await db(supabase)
    .from('matches')
    .select('*')
    .eq('id', matchId)
    .single()

  if (matchError) {
    throw new MessagingError('MATCH_NOT_FOUND', 'Match not found or not accessible')
  }

  const matchRow = match as MatchRow

  if (matchRow.proposal_required && !matchRow.proposal_sent && contentType !== 'proposal_card') {
    throw new MessagingError(
      'PROPOSAL_REQUIRED',
      'Brand must send a proposal card before free-text messages are allowed'
    )
  }

  const { data: message, error: insertError } = await db(supabase)
    .from('messages')
    .insert({ match_id: matchId, sender_id: senderId, content_type: contentType, ...payload })
    .select()
    .single()

  if (insertError) {
    throw new MessagingError('MESSAGE_INSERT_FAILED', (insertError as { message: string }).message)
  }

  if (contentType === 'proposal_card' && matchRow.proposal_required && !matchRow.proposal_sent) {
    const { error: flipError } = await db(supabase)
      .from('matches')
      .update({ proposal_sent: true })
      .eq('id', matchId)

    if (flipError) {
      throw new MessagingError(
        'PROPOSAL_FLIP_FAILED',
        (flipError as { message: string }).message
      )
    }
  }

  return message as MessageRow
}

export async function getMessages(
  supabase: SupabaseClient<Database>,
  matchId: string
): Promise<MessageRow[]> {
  // Verify match exists and caller is a participant (RLS on matches enforces this)
  const { error: matchError } = await db(supabase)
    .from('matches')
    .select('id')
    .eq('id', matchId)
    .single()

  if (matchError) {
    throw new MessagingError('MATCH_NOT_FOUND', 'Match not found or not accessible')
  }

  const { data, error } = await db(supabase)
    .from('messages')
    .select('*')
    .eq('match_id', matchId)
    .eq('is_deleted', false)
    .order('sent_at', { ascending: true })

  if (error) {
    throw new MessagingError('MESSAGES_FETCH_FAILED', (error as { message: string }).message)
  }

  return (data ?? []) as MessageRow[]
}

export async function deleteMessage(
  supabase: SupabaseClient<Database>,
  messageId: string,
  senderId: string
): Promise<void> {
  const now = new Date().toISOString()

  const { error } = await db(supabase)
    .from('messages')
    .update({ is_deleted: true, deleted_at: now })
    .eq('id', messageId)
    .eq('sender_id', senderId)
    .select()
    .single()

  if (error) {
    if ((error as { code?: string }).code === 'PGRST116') {
      throw new MessagingError('MESSAGE_NOT_FOUND', 'Message not found or not owned by sender')
    }
    throw new MessagingError('MESSAGE_DELETE_FAILED', (error as { message: string }).message)
  }
}
