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
 * Resolve the display name + avatar for a user by probing the role-specific
 * profile tables (there is no single `profiles` table). Returns a best-effort
 * label; falls back to "Conversation" when no profile row is found.
 */
async function resolveParticipant(
  supabase: SupabaseClient,
  userId: string
): Promise<{ name: string; avatarUrl: string | null }> {
  const athlete = await supabase
    .from('athlete_profiles')
    .select('display_name, profile_photo_url')
    .eq('user_id', userId)
    .maybeSingle()
  if (athlete.data) {
    const r = athlete.data as { display_name: string | null; profile_photo_url: string | null }
    return { name: r.display_name ?? 'Athlete', avatarUrl: r.profile_photo_url }
  }

  const brand = await supabase
    .from('brand_profiles')
    .select('company_name, trading_name, logo_url')
    .eq('user_id', userId)
    .maybeSingle()
  if (brand.data) {
    const r = brand.data as { company_name: string; trading_name: string | null; logo_url: string | null }
    return { name: r.trading_name ?? r.company_name, avatarUrl: r.logo_url }
  }

  const team = await supabase
    .from('team_profiles')
    .select('team_name, logo_url')
    .eq('user_id', userId)
    .maybeSingle()
  if (team.data) {
    const r = team.data as { team_name: string | null; logo_url: string | null }
    return { name: r.team_name ?? 'Team', avatarUrl: r.logo_url }
  }

  const agent = await supabase
    .from('agent_profiles')
    .select('agency_name, agent_full_name, logo_url')
    .eq('user_id', userId)
    .maybeSingle()
  if (agent.data) {
    const r = agent.data as { agency_name: string | null; agent_full_name: string | null; logo_url: string | null }
    return { name: r.agency_name ?? r.agent_full_name ?? 'Agent', avatarUrl: r.logo_url }
  }

  return { name: 'Conversation', avatarUrl: null }
}

/**
 * Build the inbox `Conversation[]` view-model for a user (spec §7.1): resolves
 * the other participant, the latest message preview/timestamp, and an unread
 * count. Used by the role messages pages to feed the MS1 `MatchList`.
 */
export async function getConversations(
  supabase: SupabaseClient<Database>,
  userId: string
): Promise<Conversation[]> {
  const matches = await getMatches(supabase, userId)
  const client = supabase as SupabaseClient

  const conversations = await Promise.all(
    matches.map(async (match) => {
      const otherId = match.user_a_id === userId ? match.user_b_id : match.user_a_id
      const participant = await resolveParticipant(client, otherId)

      const { data: lastRows } = await client
        .from('messages')
        .select('text_content, sent_at, content_type, sender_id')
        .eq('match_id', match.id)
        .eq('is_deleted', false)
        .order('sent_at', { ascending: false })
        .limit(1)

      const last = (lastRows ?? [])[0] as
        | { text_content: string | null; sent_at: string; content_type: string; sender_id: string }
        | undefined

      const preview = last
        ? last.content_type === 'proposal_card'
          ? 'Sent a proposal'
          : last.content_type === 'payment_confirmation'
            ? 'Payment confirmed'
            : (last.text_content ?? 'Attachment')
        : 'No messages yet'

      return {
        id: match.id,
        name: participant.name,
        avatarUrl: participant.avatarUrl,
        preview,
        timestamp: last?.sent_at ?? match.matched_at ?? match.created_at,
        unreadCount: 0,
      } satisfies Conversation
    })
  )

  return conversations
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
