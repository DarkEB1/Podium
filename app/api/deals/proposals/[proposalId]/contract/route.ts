import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getUser } from '@/lib/supabase/auth'
import { getContract, DealsError } from '@/lib/supabase/deals'

export async function GET(
  _request: NextRequest,
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

  const { proposalId } = await params

  try {
    const contract = await getContract(supabase, proposalId)

    if (!contract) {
      return NextResponse.json(
        { error: { code: 'CONTRACT_NOT_FOUND', message: 'No contract exists for this proposal' } },
        { status: 404 }
      )
    }

    return NextResponse.json(contract)
  } catch (err) {
    if (err instanceof DealsError && err.code === 'CONTRACT_FETCH_FAILED') {
      return NextResponse.json(
        { error: { code: 'CONTRACT_FETCH_FAILED', message: err.message } },
        { status: 500 }
      )
    }
    throw err
  }
}
