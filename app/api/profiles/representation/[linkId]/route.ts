import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getUser } from '@/lib/supabase/auth'
import { respondRepresentationLink, ProfileError } from '@/lib/supabase/profiles'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ linkId: string }> }
) {
  const supabase = await createClient()
  const user = await getUser(supabase)

  if (!user) {
    return NextResponse.json(
      { error: { code: 'UNAUTHENTICATED', message: 'Authentication required' } },
      { status: 401 }
    )
  }

  const { linkId } = await params
  const body = (await request.json()) as { accept?: unknown }

  if (body.accept === undefined || body.accept === null) {
    return NextResponse.json(
      { error: { code: 'MISSING_FIELDS', message: 'accept field is required' } },
      { status: 400 }
    )
  }

  try {
    await respondRepresentationLink(supabase, linkId, user.id, Boolean(body.accept))
    return NextResponse.json({ success: true })
  } catch (err) {
    if (err instanceof ProfileError && err.code === 'LINK_NOT_FOUND') {
      return NextResponse.json(
        { error: { code: 'LINK_NOT_FOUND', message: 'Link not found or not accessible' } },
        { status: 404 }
      )
    }
    throw err
  }
}
