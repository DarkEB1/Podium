import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getUser } from '@/lib/supabase/auth'
import { getMessages, sendMessage, MessagingError } from '@/lib/supabase/messaging'
import { RATE_LIMITS, consume, tooManyRequests, userKey } from '@/lib/rate-limit'
import type { Database } from '@/types/database'

type MessageType = Database['public']['Enums']['message_type']

const VALID_MESSAGE_TYPES = new Set<MessageType>([
  'text', 'image', 'video', 'document',
  'proposal_card', 'esignature_request', 'payment_confirmation',
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

  const { matchId } = await params
  const { content_type, text_content, attachment_url, attachment_size_bytes, attachment_mime_type, metadata } = body

  const payload = {
    ...(text_content !== undefined && { text_content }),
    ...(attachment_url !== undefined && { attachment_url }),
    ...(attachment_size_bytes !== undefined && { attachment_size_bytes }),
    ...(attachment_mime_type !== undefined && { attachment_mime_type }),
    ...(metadata !== undefined && { metadata }),
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
