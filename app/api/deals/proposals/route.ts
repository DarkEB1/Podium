import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { getUser } from '@/lib/supabase/auth'
import { sendProposal, getProposals, DealsError } from '@/lib/supabase/deals'
import { getMatches } from '@/lib/supabase/messaging'
import { RATE_LIMITS, consume, tooManyRequests, userKey } from '@/lib/rate-limit'
import { PROPOSAL_TERMS_MAX, PROPOSAL_TITLE_MAX } from '@/lib/limits'
import {
  normaliseCurrency,
  validatePayAmount,
  validateTimeline,
  normaliseTimeline,
} from '@/lib/deals-validation'
import { sendTransactionalEmail } from '@/lib/email'
import { absoluteUrl, nameOf, resolveDisplayNames, FALLBACK_OTHER_NAME } from '@/lib/email/notify'
import { ROUTES } from '@/lib/routes'
import type { Database, Json } from '@/types/database'

type PayType = Database['public']['Enums']['pay_type']

const VALID_PAY_TYPES = new Set<PayType>(['flat_fee', 'monthly_retainer', 'per_post', 'revenue_share'])

/** DealsError codes this endpoint answers with, and the status each deserves. */
const PROPOSAL_ERROR_STATUS: Record<string, number> = {
  PROPOSAL_INSERT_FAILED: 422,
  UNAUTHENTICATED: 401,
  NOT_PARTICIPANT: 403,
  MATCH_NOT_FOUND: 404,
}

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const user = await getUser(supabase)

  if (!user) {
    return NextResponse.json(
      { error: { code: 'UNAUTHENTICATED', message: 'Authentication required' } },
      { status: 401 }
    )
  }

  const matchId = request.nextUrl.searchParams.get('matchId')

  if (!matchId) {
    return NextResponse.json(
      { error: { code: 'MISSING_FIELDS', message: 'matchId query parameter is required' } },
      { status: 400 }
    )
  }

  try {
    const proposals = await getProposals(supabase, matchId)
    return NextResponse.json(proposals)
  } catch (err) {
    if (err instanceof DealsError && err.code === 'MATCH_NOT_FOUND') {
      return NextResponse.json(
        { error: { code: 'MATCH_NOT_FOUND', message: err.message } },
        { status: 404 }
      )
    }
    throw err
  }
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const user = await getUser(supabase)

  if (!user) {
    return NextResponse.json(
      { error: { code: 'UNAUTHENTICATED', message: 'Authentication required' } },
      { status: 401 }
    )
  }

  // DH-2: per-user write limit, in its own key namespace (see connections).
  const limited = await consume(userKey('proposal_send', user.id), RATE_LIMITS.writeByUser)
  if (!limited.allowed) return tooManyRequests(limited.retryAfter)

  const body = (await request.json()) as {
    match_id?: string
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

  const { match_id, title, pay_amount, pay_type } = body

  if (!match_id || !title || pay_amount === undefined || !pay_type) {
    return NextResponse.json(
      { error: { code: 'MISSING_FIELDS', message: 'match_id, title, pay_amount, and pay_type are required' } },
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

  // WS-DEAL-04: only GBP/USD/EUR are billable. An unvalidated code makes
  // Intl.NumberFormat throw RangeError on the deals pages (500 for both
  // parties) and Stripe reject the intent. Default to GBP when omitted.
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

  // DP-10: reject end-before-start / malformed dates here rather than letting a
  // Postgres 22007 surface as raw text in a 422.
  const timelineError = validateTimeline(body.timeline_start, body.timeline_end)
  if (timelineError) {
    return NextResponse.json(
      { error: { code: 'INVALID_TIMELINE', message: timelineError } },
      { status: 400 }
    )
  }

  // Both free-text columns on this insert are plain `text` with no CHECK.
  // PROPOSAL_TERMS_MAX was exported from lib/limits.ts and imported by nobody,
  // so additional_terms reached the database unbounded; title never had a
  // server-side cap at all, only the composer's.
  if (title.length > PROPOSAL_TITLE_MAX) {
    return NextResponse.json(
      {
        error: {
          code: 'TITLE_TOO_LONG',
          message: `Title must be ${PROPOSAL_TITLE_MAX} characters or fewer`,
        },
      },
      { status: 400 }
    )
  }

  if (typeof body.additional_terms === 'string' && body.additional_terms.length > PROPOSAL_TERMS_MAX) {
    return NextResponse.json(
      {
        error: {
          code: 'TERMS_TOO_LONG',
          message: `Additional terms must be ${PROPOSAL_TERMS_MAX} characters or fewer`,
        },
      },
      { status: 400 }
    )
  }

  try {
    const proposal = await sendProposal(supabase, match_id, user.id, {
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
    // Side effect after the proposal is durably stored: email the OTHER match
    // participant (never the sender) that a proposal arrived. Resolve the
    // recipient from the match; best-effort so the created proposal is still
    // returned even if the match/name lookup comes up empty.
    const admin = createAdminClient()
    const matches = await getMatches(admin, user.id)
    const match = matches.find((m) => m.id === proposal.match_id)
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
          proposalTitle: proposal.title,
          url: absoluteUrl(ROUTES.dashboard),
        },
      })
    }

    return NextResponse.json(proposal, { status: 201 })
  } catch (err) {
    if (err instanceof DealsError) {
      // send_proposal does its own authorization (it is SECURITY DEFINER), so
      // these two now reach the route and need real statuses. Re-throwing them
      // would return an empty non-JSON 500 that a client cannot parse.
      const status = PROPOSAL_ERROR_STATUS[err.code]
      if (status) {
        return NextResponse.json({ error: { code: err.code, message: err.message } }, { status })
      }
    }
    throw err
  }
}
