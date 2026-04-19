import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

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
  // as SupabaseClient: strips the Database generic to avoid deep PostgREST chain type inference
  const { data, error } = await (supabase as SupabaseClient)
    .from('matches')
    .select('*')
    .or(`user_a_id.eq.${userId},user_b_id.eq.${userId}`)
    .eq('status', 'active')

  if (error) {
    throw new MessagingError('MATCHES_FETCH_FAILED', (error as { message: string }).message)
  }

  return (data ?? []) as MatchRow[]
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
  // as SupabaseClient: strips the Database generic to avoid deep PostgREST chain type inference
  const { data: match, error: matchError } = await (supabase as SupabaseClient)
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

  // as SupabaseClient: strips the Database generic to avoid deep PostgREST chain type inference
  const { data: message, error: insertError } = await (supabase as SupabaseClient)
    .from('messages')
    .insert({ match_id: matchId, sender_id: senderId, content_type: contentType, ...payload })
    .select()
    .single()

  if (insertError) {
    throw new MessagingError('MESSAGE_INSERT_FAILED', (insertError as { message: string }).message)
  }

  if (contentType === 'proposal_card' && matchRow.proposal_required && !matchRow.proposal_sent) {
    // as SupabaseClient: strips the Database generic to avoid deep PostgREST chain type inference
    const { error: flipError } = await (supabase as SupabaseClient)
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
  // as SupabaseClient: strips the Database generic to avoid deep PostgREST chain type inference
  const { error: matchError } = await (supabase as SupabaseClient)
    .from('matches')
    .select('id')
    .eq('id', matchId)
    .single()

  if (matchError) {
    throw new MessagingError('MATCH_NOT_FOUND', 'Match not found or not accessible')
  }

  // as SupabaseClient: strips the Database generic to avoid deep PostgREST chain type inference
  const { data, error } = await (supabase as SupabaseClient)
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

  // as SupabaseClient: strips the Database generic to avoid deep PostgREST chain type inference
  const { error } = await (supabase as SupabaseClient)
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
