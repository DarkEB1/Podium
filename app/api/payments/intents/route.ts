import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { getUser } from '@/lib/supabase/auth'
import {
  getContractForPayment,
  getSubscriptionForUser,
  createPaymentRecord,
  PaymentsError,
} from '@/lib/supabase/payments'
import { createPaymentIntent } from '@/lib/stripe'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const user = await getUser(supabase)

  if (!user) {
    return NextResponse.json(
      { error: { code: 'UNAUTHENTICATED', message: 'Authentication required' } },
      { status: 401 }
    )
  }

  if (user.role !== 'brand') {
    return NextResponse.json(
      { error: { code: 'BRAND_ONLY', message: 'Only brand accounts can initiate payments' } },
      { status: 403 }
    )
  }

  const body = (await request.json()) as { contractId?: string }
  const { contractId } = body

  if (!contractId) {
    return NextResponse.json(
      { error: { code: 'MISSING_FIELDS', message: 'contractId is required' } },
      { status: 400 }
    )
  }

  let contract
  try {
    contract = await getContractForPayment(supabase, contractId)
  } catch (err) {
    if (err instanceof PaymentsError && err.code === 'CONTRACT_NOT_FOUND') {
      return NextResponse.json(
        { error: { code: 'CONTRACT_NOT_FOUND', message: err.message } },
        { status: 404 }
      )
    }
    throw err
  }

  if (contract.brand_id !== user.id) {
    return NextResponse.json(
      { error: { code: 'NOT_CONTRACT_BRAND', message: 'You are not the brand on this contract' } },
      { status: 403 }
    )
  }

  const subscription = await getSubscriptionForUser(supabase, user.id)

  if (!subscription) {
    return NextResponse.json(
      { error: { code: 'NO_SUBSCRIPTION', message: 'Active subscription with billing details required' } },
      { status: 404 }
    )
  }

  // payments.payer_id / payee_id are FKs to users.id. contracts.brand_id and
  // contracts.athlete_or_team_id are both users.id, and brand_id === user.id is
  // enforced above. These same ids go into the intent metadata so the webhook
  // reader can never disagree with this writer (ST-5).
  const payerId = user.id
  const payeeId = contract.athlete_or_team_id

  const { clientSecret, paymentIntentId } = await createPaymentIntent({
    contractId,
    payerId,
    payeeId,
    amount: contract.pay_amount,
    currency: contract.pay_currency.toLowerCase(),
    customerId: subscription.stripe_customer_id,
  })

  const adminSupabase = createAdminClient()
  const payment = await createPaymentRecord(adminSupabase, {
    contract_id: contractId,
    payer_id: payerId,
    payee_id: payeeId,
    stripe_payment_intent_id: paymentIntentId,
    amount: contract.pay_amount,
    currency: contract.pay_currency,
  })

  return NextResponse.json({ clientSecret, paymentIntentId, paymentId: payment.id }, { status: 201 })
}
