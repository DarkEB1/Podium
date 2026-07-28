import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getUser } from '@/lib/supabase/auth'
import { isSocialProvider } from '@/lib/social/providers'
import { disconnect } from '@/lib/social'

/** Remove the caller's connection for a provider. */
export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ provider: string }> }) {
  const { provider } = await params
  if (!isSocialProvider(provider)) {
    return NextResponse.json({ error: { code: 'UNKNOWN_PROVIDER', message: 'Unknown provider' } }, { status: 404 })
  }

  const supabase = await createClient()
  const user = await getUser(supabase)
  if (!user) {
    return NextResponse.json({ error: { code: 'UNAUTHENTICATED', message: 'Sign in required' } }, { status: 401 })
  }

  await disconnect(supabase, user.id, provider)
  return NextResponse.json({ ok: true })
}
