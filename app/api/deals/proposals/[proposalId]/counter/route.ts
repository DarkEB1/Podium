import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getUser } from '@/lib/supabase/auth'
import { counterProposal, DealsError } from '@/lib/supabase/deals'
import type { Database, Json } from '@/types/database'

type PayType = Database['public']['Enums']['pay_type']

const VALID_PAY_TYPES = new Set<PayType>(['flat_fee', 'monthly_retainer', 'per_post', 'revenue_share'])

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

  if (typeof pay_amount !== 'number' || pay_amount <= 0) {
    return NextResponse.json(
      { error: { code: 'INVALID_PAY_AMOUNT', message: 'pay_amount must be a positive number' } },
      { status: 400 }
    )
  }

  if (!VALID_PAY_TYPES.has(pay_type as PayType)) {
    return NextResponse.json(
      { error: { code: 'INVALID_PAY_TYPE', message: 'Invalid pay_type value' } },
      { status: 400 }
    )
  }

  const { proposalId } = await params

  try {
    const counter = await counterProposal(supabase, proposalId, user.id, {
      title,
      pay_amount,
      pay_type: pay_type as PayType,
      ...(body.deliverables !== undefined && { deliverables: body.deliverables }),
      ...(body.pay_currency !== undefined && { pay_currency: body.pay_currency }),
      ...(body.timeline_start !== undefined && { timeline_start: body.timeline_start }),
      ...(body.timeline_end !== undefined && { timeline_end: body.timeline_end }),
      ...(body.usage_rights !== undefined && { usage_rights: body.usage_rights }),
      ...(body.additional_terms !== undefined && { additional_terms: body.additional_terms }),
    })
    return NextResponse.json(counter, { status: 201 })
  } catch (err) {
    if (err instanceof DealsError) {
      if (err.code === 'PROPOSAL_NOT_FOUND') {
        return NextResponse.json(
          { error: { code: 'PROPOSAL_NOT_FOUND', message: err.message } },
          { status: 404 }
        )
      }
      if (err.code === 'PROPOSAL_NOT_PENDING') {
        return NextResponse.json(
          { error: { code: 'PROPOSAL_NOT_PENDING', message: err.message } },
          { status: 409 }
        )
      }
      if (err.code === 'NOT_RECIPIENT') {
        return NextResponse.json(
          { error: { code: 'NOT_RECIPIENT', message: err.message } },
          { status: 403 }
        )
      }
      if (err.code === 'COUNTER_INSERT_FAILED' || err.code === 'PROPOSAL_UPDATE_FAILED') {
        return NextResponse.json(
          { error: { code: err.code, message: err.message } },
          { status: 500 }
        )
      }
    }
    throw err
  }
}
