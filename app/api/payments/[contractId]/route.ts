import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getUser } from '@/lib/supabase/auth'
import { getPayment } from '@/lib/supabase/payments'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ contractId: string }> }
) {
  const supabase = await createClient()
  const user = await getUser(supabase)

  if (!user) {
    return NextResponse.json(
      { error: { code: 'UNAUTHENTICATED', message: 'Authentication required' } },
      { status: 401 }
    )
  }

  const { contractId } = await params
  const payment = await getPayment(supabase, contractId)
  return NextResponse.json(payment)
}
