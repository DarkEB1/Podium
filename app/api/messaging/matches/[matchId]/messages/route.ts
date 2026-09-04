import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getUser } from '@/lib/supabase/auth'
import { getMessages, sendMessage, MessagingError } from '@/lib/supabase/messaging'
import { assertCanSendMessage } from '@/lib/supabase/entitlements'
import { RATE_LIMITS, consume, tooManyRequests, userKey } from '@/lib/rate-limit'
import { CHAT_MESSAGE_MAX } from '@/lib/limits'
import type { Database } from '@/types/database'

type MessageType = Database['public']['Enums']['message_type']

/**
 * SEC-3 — the content types a PARTICIPANT may create.
 *
 * `proposal_card`, `esignature_request` and `payment_confirmation` are system
 * types: they carry `metadata.proposal_id` and the chat renders them as
 * authoritative status cards. Nothing server-side has ever created one (a
 * proposal is written by the `send_proposal` RPC, into `proposals`, and the
 * composer only ever sends `text`), so allowing them here was pure attack
 * surface: a brand could POST `payment_confirmation` with a real proposal id
 * and the athlete, who may be a minor, would see a green "Payment confirmed"
 * card showing the real deal amount for money that was never sent.
 *
 * If a system card is ever needed, it must be written server-side by the code
 * that owns the event, never accepted from a client.
 */
const VALID_MESSAGE_TYPES = new Set<MessageType>([
  'text', 'image', 'video', 'document',
])

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ matchId: string }> }
) {
  const supabase = await createClient()
  const user = await getUser(supabase)

  if (!user) {
    return NextResponse.json(
      { error: { code: 'UNAUTHENTICATED', message: 'Authentication required' } },
      { status: 401 }
    )
  }

  const { matchId } = await params

  try {
    const messages = await getMessages(supabase, matchId)
    return NextResponse.json(messages)
  } catch (err) {
    if (err instanceof MessagingError && err.code === 'MATCH_NOT_FOUND') {
      return NextResponse.json(
        { error: { code: 'MATCH_NOT_FOUND', message: err.message } },
        { status: 404 }
      )
    }
    throw err
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ matchId: string }> }
) {
  const supabase = await createClient()
  const user = await getUser(supabase)

  if (!user) {
    return NextResponse.json(
      { error: { code: 'UNAUTHENTICATED', message: 'Authentication required' } },
      { status: 401 }
    )
  }

  // DH-2: chat is the highest-frequency write in the product, so it gets its
  // OWN key namespace rather than sharing one budget with proposals — 60 sends
  // per minute is roughly one per second, far above any human typing cadence
  // but low enough to stop a scripted flood, and a chatty conversation can no
  // longer lock the user out of sending a proposal.
  const limited = await consume(userKey('message_send', user.id), RATE_LIMITS.writeByUser)
  if (!limited.allowed) return tooManyRequests(limited.retryAfter)

  // Entitlement gate: gated brands are capped on messages sent per billing
  // period per their subscription tier (see lib/supabase/entitlements.ts).
  const gate = await assertCanSendMessage(supabase, user.id, user.role)
  if (!gate.allowed) {
    return NextResponse.json(
      {
        error: {
          code: gate.reason === 'NO_SUBSCRIPTION' ? 'SUBSCRIPTION_REQUIRED' : 'LIMIT_REACHED',
          message:
            gate.reason === 'NO_SUBSCRIPTION'
              ? 'An active subscription is required to send messages.'
              : `You have reached your plan's limit of ${gate.limit} messages this billing period. Upgrade for unlimited messaging.`,
        },
        limit: gate.limit,
        used: gate.used,
        tier: gate.tier,
      },
      { status: 402 }
    )
  }

  const body = (await request.json()) as {
    content_type?: string
    text_content?: string
    attachment_url?: string
    attachment_size_bytes?: number
    attachment_mime_type?: string
    metadata?: Record<string, unknown>
  }

  if (!body.content_type) {
    return NextResponse.json(
      { error: { code: 'MISSING_FIELDS', message: 'content_type is required' } },
      { status: 400 }
    )
  }

  if (!VALID_MESSAGE_TYPES.has(body.content_type as MessageType)) {
    return NextResponse.json(
      { error: { code: 'INVALID_CONTENT_TYPE', message: 'Invalid content_type value' } },
      { status: 400 }
    )
  }

  // WS-MSG-07: reject attachments outright until the attachment UI ships.
  //
  // The chat renders `attachment_url` for the OTHER party as a download link and,
  // for images, an <img>. Nothing server-side validates that URL, so a sender
  // could point it off-site: a phishing link, a tracking pixel, or a bare-IP
  // logger that de-anonymises a viewer who may be a minor. No composer sends an
  // attachment today (the only content_type sent is 'text'), so the safest and
  // simplest fix is to refuse every attachment content type and every attachment
  // field here. When the upload UI lands, replace this with: require an own-bucket
  // (Supabase Storage) URL + a MIME allow-list + a size cap.
  const ATTACHMENT_CONTENT_TYPES = new Set<MessageType>(['image', 'video', 'document'])
  if (
    ATTACHMENT_CONTENT_TYPES.has(body.content_type as MessageType) ||
    body.attachment_url !== undefined ||
    body.attachment_size_bytes !== undefined ||
    body.attachment_mime_type !== undefined
  ) {
    return NextResponse.json(
      {
        error: {
          code: 'ATTACHMENTS_NOT_ENABLED',
          message: 'Attachments are not supported yet.',
        },
      },
      { status: 400 }
    )
  }

  // SEC-3: `metadata` exists to carry the proposal id of a system card. No
  // client-creatable type uses it, so accepting it would just reopen the
  // forged-card path through a type that is still allowed.
  if (body.metadata !== undefined) {
    return NextResponse.json(
      { error: { code: 'METADATA_NOT_ALLOWED', message: 'metadata cannot be set on a message' } },
      { status: 400 }
    )
  }

  // SEC-4: CHAT_MESSAGE_MAX existed in lib/limits.ts but nothing imported it,
  // and `messages` has no CHECK constraint, so text_content was unbounded all
  // the way to the database. getMessages returns a match's messages unpaginated,
  // so one scripted sender could make the other participant's chat unloadable.
  if (typeof body.text_content === 'string' && body.text_content.length > CHAT_MESSAGE_MAX) {
    return NextResponse.json(
      {
        error: {
          code: 'MESSAGE_TOO_LONG',
          message: `Messages must be ${CHAT_MESSAGE_MAX} characters or fewer`,
        },
      },
      { status: 400 }
    )
  }

  const { matchId } = await params
  const { content_type, text_content, attachment_url, attachment_size_bytes, attachment_mime_type } = body

  const payload = {
    ...(text_content !== undefined && { text_content }),
    ...(attachment_url !== undefined && { attachment_url }),
    ...(attachment_size_bytes !== undefined && { attachment_size_bytes }),
    ...(attachment_mime_type !== undefined && { attachment_mime_type }),
  }

  try {
    const message = await sendMessage(
      supabase,
      matchId,
      user.id,
      content_type as MessageType,
      payload
    )
    return NextResponse.json(message, { status: 201 })
  } catch (err) {
    if (err instanceof MessagingError) {
      if (err.code === 'MATCH_NOT_FOUND') {
        return NextResponse.json(
          { error: { code: 'MATCH_NOT_FOUND', message: err.message } },
          { status: 404 }
        )
      }
      if (err.code === 'PROPOSAL_REQUIRED') {
        return NextResponse.json(
          { error: { code: 'PROPOSAL_REQUIRED', message: err.message } },
          { status: 403 }
        )
      }
    }
    throw err
  }
}
