import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { getUser } from '@/lib/supabase/auth'
import { signContract, DealsError } from '@/lib/supabase/deals'

export async function POST(
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
  const adminSupabase = createAdminClient()

  try {
    const contract = await signContract(supabase, adminSupabase, contractId, user.id)
    return NextResponse.json(contract)
  } catch (err) {
    if (err instanceof DealsError) {
      if (err.code === 'CONTRACT_NOT_FOUND') {
        return NextResponse.json(
          { error: { code: 'CONTRACT_NOT_FOUND', message: err.message } },
          { status: 404 }
        )
      }
      if (err.code === 'NOT_PARTICIPANT') {
        return NextResponse.json(
          { error: { code: 'NOT_PARTICIPANT', message: err.message } },
          { status: 403 }
        )
      }
      if (err.code === 'ALREADY_SIGNED') {
        return NextResponse.json(
          { error: { code: 'ALREADY_SIGNED', message: err.message } },
          { status: 409 }
        )
      }
    }
    throw err
  }
}
