import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getUser } from '@/lib/supabase/auth'
import { isSocialProvider, providerConfigured } from '@/lib/social/providers'
import { buildAuthorizeUrl, generateState } from '@/lib/social'
import { absoluteUrl } from '@/lib/email/notify'
import { ROUTES } from '@/lib/routes'

/** Begin the OAuth connect flow: set a CSRF state cookie and redirect to the provider. */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ provider: string }> }) {
  const { provider } = await params
  if (!isSocialProvider(provider)) {
    return NextResponse.json({ error: { code: 'UNKNOWN_PROVIDER', message: 'Unknown provider' } }, { status: 404 })
  }

  const supabase = await createClient()
  const user = await getUser(supabase)
  if (!user) return NextResponse.redirect(absoluteUrl(ROUTES.auth.signIn))

  if (!providerConfigured(provider)) {
    return NextResponse.redirect(absoluteUrl('/settings/security?social=unavailable'))
  }

  const state = generateState()
  const redirectUri = absoluteUrl(`/api/social/${provider}/callback`)
  const res = NextResponse.redirect(buildAuthorizeUrl(provider, state, redirectUri))
  res.cookies.set(`social_oauth_state_${provider}`, state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 600,
  })
  return res
}
