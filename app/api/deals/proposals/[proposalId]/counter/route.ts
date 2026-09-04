import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { getUser } from '@/lib/supabase/auth'
import { counterProposal, DealsError } from '@/lib/supabase/deals'
import { getMatches } from '@/lib/supabase/messaging'
import { RATE_LIMITS, consume, tooManyRequests, userKey } from '@/lib/rate-limit'
import {
  normaliseCurrency,
  validatePayAmount,
  validateTimeline,
  normaliseTimeline,
} from '@/lib/deals-validation'
import { PROPOSAL_TERMS_MAX, PROPOSAL_TITLE_MAX } from '@/lib/limits'
import { sendTransactionalEmail } from '@/lib/email'
import { absoluteUrl, nameOf, resolveDisplayNames, FALLBACK_OTHER_NAME } from '@/lib/email/notify'
import { ROUTES } from '@/lib/routes'
import type { Database, Json } from '@/types/database'

type PayType = Database['public']['Enums']['pay_type']

const VALID_PAY_TYPES = new Set<PayType>(['flat_fee', 'monthly_retainer', 'per_post', 'revenue_share'])

/** DealsError codes this endpoint answers with, and the status each deserves. */
const COUNTER_ERROR_STATUS: Record<string, number> = {
  PROPOSAL_NOT_FOUND: 404,
  PROPOSAL_NOT_PENDING: 409,
  NOT_RECIPIENT: 403,
  // DP-11: the counter RPC is SECURITY DEFINER, so these reach the route and
  // need real statuses. Re-throwing produced an empty non-JSON 500 and, for a
  // non-participant, an existence oracle (500 here vs 404 on the decline path).
  NOT_PARTICIPANT: 403,
  NO_BRAND_PARTICIPANT: 409,
  AMBIGUOUS_BRAND_PARTICIPANTS: 409,
  COUNTERPARTY_NOT_ATHLETE_OR_TEAM: 409,
  COUNTER_INSERT_FAILED: 500,
  PROPOSAL_UPDATE_FAILED: 500,
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ proposalId: string }> }
) {
  const supabase = await createClient()
  const user = await getUser(supabase)

  if (!user) {
    return NextResponse.json(
      { error: { code: 'UNAUTHENTICATED', message: 'Authentication required' } },
      { status: 401 }
    )
  }

  // DH-2: a counter both inserts a proposal and supersedes another — limited
  // per user in its own key namespace.
  const limited = await consume(userKey('proposal_counter', user.id), RATE_LIMITS.writeByUser)
  if (!limited.allowed) return tooManyRequests(limited.retryAfter)

  const body = (await request.json()) as {
    title?: string
    deliverables?: Json
    pay_amount?: number
    pay_currency?: string
    pay_type?: string
    timeline_start?: string
    timeline_end?: string
    usage_rights?: Json
    additional_terms?: string
  }

  const { title, pay_amount, pay_type } = body

  if (!title || pay_amount === undefined || !pay_type) {
    return NextResponse.json(
      { error: { code: 'MISSING_FIELDS', message: 'title, pay_amount, and pay_type are required' } },
      { status: 400 }
    )
  }

  const amountError = validatePayAmount(pay_amount)
  if (amountError) {
    return NextResponse.json(
      { error: { code: 'INVALID_PAY_AMOUNT', message: amountError } },
      { status: 400 }
    )
  }

  if (!VALID_PAY_TYPES.has(pay_type as PayType)) {
    return NextResponse.json(
      { error: { code: 'INVALID_PAY_TYPE', message: 'Invalid pay_type value' } },
      { status: 400 }
    )
  }

  // WS-DEAL-04: only GBP/USD/EUR are billable (see proposals/route.ts).
  let payCurrency = 'GBP'
  if (body.pay_currency !== undefined) {
    const normalised = normaliseCurrency(body.pay_currency)
    if (!normalised) {
      return NextResponse.json(
        { error: { code: 'INVALID_CURRENCY', message: 'Currency must be one of GBP, USD, EUR' } },
        { status: 400 }
      )
    }
    payCurrency = normalised
  }

  const timelineError = validateTimeline(body.timeline_start, body.timeline_end)
  if (timelineError) {
    return NextResponse.json(
      { error: { code: 'INVALID_TIMELINE', message: timelineError } },
      { status: 400 }
    )
  }

  if (title.length > PROPOSAL_TITLE_MAX) {
    return NextResponse.json(
      { error: { code: 'TITLE_TOO_LONG', message: `Title must be ${PROPOSAL_TITLE_MAX} characters or fewer` } },
      { status: 400 }
    )
  }

  if (typeof body.additional_terms === 'string' && body.additional_terms.length > PROPOSAL_TERMS_MAX) {
    return NextResponse.json(
      { error: { code: 'TERMS_TOO_LONG', message: `Additional terms must be ${PROPOSAL_TERMS_MAX} characters or fewer` } },
      { status: 400 }
    )
  }

  const { proposalId } = await params

  try {
    const counter = await counterProposal(supabase, proposalId, user.id, {
      title,
      pay_amount,
      pay_type: pay_type as PayType,
      pay_currency: payCurrency,
      timeline_start: normaliseTimeline(body.timeline_start),
      timeline_end: normaliseTimeline(body.timeline_end),
      ...(body.deliverables !== undefined && { deliverables: body.deliverables }),
      ...(body.usage_rights !== undefined && { usage_rights: body.usage_rights }),
      ...(body.additional_terms !== undefined && { additional_terms: body.additional_terms }),
    })

    // DP-8: the recipient of a counter-offer was never told. Email the OTHER
    // match participant (the party being countered) that a fresh proposal
    // arrived — the same event the initial proposal send uses. Best-effort so a
    // name/match lookup miss never fails the already-committed counter.
    const admin = createAdminClient()
    const matches = await getMatches(admin, user.id)
    const match = matches.find((m) => m.id === counter.match_id)
    const recipientId = match
      ? match.user_a_id === user.id
        ? match.user_b_id
        : match.user_a_id
      : null

    if (recipientId) {
      const names = await resolveDisplayNames(admin, [recipientId, user.id])
      await sendTransactionalEmail(admin, {
        event: 'proposal_received',
        userId: recipientId,
        data: {
          recipientName: nameOf(names, recipientId),
          senderName: nameOf(names, user.id, FALLBACK_OTHER_NAME),
          proposalTitle: counter.title,
          url: absoluteUrl(ROUTES.dashboard),
        },
      })
    }

    return NextResponse.json(counter, { status: 201 })
  } catch (err) {
    if (err instanceof DealsError) {
      const status = COUNTER_ERROR_STATUS[err.code]
      if (status) {
        return NextResponse.json({ error: { code: err.code, message: err.message } }, { status })
      }
    }
    throw err
  }
}
