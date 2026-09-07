import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { getUser } from '@/lib/supabase/auth'
import {
  getContractForPayment,
  getSubscriptionForUser,
  createPaymentRecord,
  getLivePaymentForContract,
  PaymentsError,
} from '@/lib/supabase/payments'
import { randomUUID } from 'node:crypto'
import { createPaymentIntent, toMinorUnits } from '@/lib/stripe'

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

  const adminSupabase = createAdminClient()

  // ST-7: without this, a second POST for the same contract inserted a SECOND
  // payments row. Stripe's idempotency key returns the same intent id, so two
  // rows then shared one `stripe_payment_intent_id`, and `getPaymentByIntentId`
  // uses `.single()`, which errors on multiple rows and is read as "not found".
  // The webhook then marked the settlement unprocessable and answered 200, so
  // Stripe never retried and a charged payment was stranded 'pending' forever.
  // A unique index (20260805000200) is the backstop; this is the friendly path.
  const live = await getLivePaymentForContract(adminSupabase, contractId)
  if (live) {
    return NextResponse.json(
      {
        error: {
          code: 'PAYMENT_ALREADY_STARTED',
          message: 'A payment for this contract has already been started.',
        },
      },
      { status: 409 }
    )
  }

  // ST-6: pay_amount is MAJOR units; Stripe and payments.amount are MINOR.
  const amountMinor = toMinorUnits(contract.pay_amount)

  const { clientSecret, paymentIntentId } = await createPaymentIntent({
    contractId,
    payerId,
    payeeId,
    amountMinor,
    currency: contract.pay_currency.toLowerCase(),
    customerId: subscription.stripe_customer_id,
    // DP-6: a per-attempt key. The live-payment guard above already blocked a
    // second intent while one is pending/succeeded, so reaching here means the
    // previous attempt is terminal (failed/refunded) and this is a fresh charge
    // that must get its own PaymentIntent id rather than replaying the old one.
    idempotencyKey: `pi_${contractId}_${randomUUID()}`,
  })

  const payment = await createPaymentRecord(adminSupabase, {
    contract_id: contractId,
    payer_id: payerId,
    payee_id: payeeId,
    stripe_payment_intent_id: paymentIntentId,
    amount: amountMinor,
    currency: contract.pay_currency,
  })

  return NextResponse.json({ clientSecret, paymentIntentId, paymentId: payment.id }, { status: 201 })
}
