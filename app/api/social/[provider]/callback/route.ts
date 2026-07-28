import { NextResponse, type NextRequest } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { getUser } from '@/lib/supabase/auth'
import { isSocialProvider } from '@/lib/social/providers'
import { exchangeCodeForToken, storeConnection } from '@/lib/social'
import { absoluteUrl } from '@/lib/email/notify'
import { ROUTES } from '@/lib/routes'

/** OAuth callback: validate state, exchange the code, store the connection. */
export async function GET(request: NextRequest, { params }: { params: Promise<{ provider: string }> }) {
  const { provider } = await params
  if (!isSocialProvider(provider)) {
    return NextResponse.json({ error: { code: 'UNKNOWN_PROVIDER', message: 'Unknown provider' } }, { status: 404 })
  }

  const supabase = await createClient()
  const user = await getUser(supabase)
  if (!user) return NextResponse.redirect(absoluteUrl(ROUTES.auth.signIn))

  const url = new URL(request.url)
  const code = url.searchParams.get('code')
  const state = url.searchParams.get('state')
  const cookieState = request.cookies.get(`social_oauth_state_${provider}`)?.value

  const done = (result: string) => {
    const res = NextResponse.redirect(absoluteUrl(`/settings/security?social=${result}`))
    res.cookies.delete(`social_oauth_state_${provider}`)
    return res
  }

  // CSRF: the provider must echo the exact state we set, or it is not our flow.
  if (!code || !state || !cookieState || state !== cookieState) {
    return done('failed')
  }

  try {
    const token = await exchangeCodeForToken(provider, code, absoluteUrl(`/api/social/${provider}/callback`))
    await storeConnection(createAdminClient(), user.id, provider, token)
    return done('connected')
  } catch {
    return done('failed')
  }
}
