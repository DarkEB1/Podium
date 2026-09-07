import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { markEmailVerified } from '@/lib/supabase/auth'
import { ROUTES } from '@/lib/routes'
import { AUTH_ERROR_CODES, classifyAuthError } from '@/components/auth/auth-errors'
import { setRecoveryCookie } from '@/lib/auth/recovery-cookie'

/**
 * B-3 / NX-1 — auth callback.
 *
 * Failures redirect to the real sign-in route (`ROUTES.auth.signIn` = `/auth`)
 * carrying an `?error=` code that the sign-in page renders as human-readable
 * copy. It previously redirected to `/login`, which does not exist, so every
 * failure 404'd and the reason was never shown.
 */
function failure(origin: string, code: string): NextResponse {
  const url = new URL(ROUTES.auth.signIn, origin)
  url.searchParams.set('error', code)
  return NextResponse.redirect(url)
}

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)

  // Supabase appends these itself when the confirmation fails before reaching
  // us (expired / already-consumed link). Honour them first.
  const providerError = searchParams.get('error')
  if (providerError) {
    return failure(
      origin,
      classifyAuthError(
        searchParams.get('error_code') ?? providerError,
        searchParams.get('error_description'),
      ),
    )
  }

  const code = searchParams.get('code')
  const type = searchParams.get('type')

  if (!code) {
    return failure(origin, AUTH_ERROR_CODES.missingCode)
  }

  const supabase = await createClient()
  const { data, error } = await supabase.auth.exchangeCodeForSession(code)

  if (error || !data.session) {
    return failure(origin, classifyAuthError(null, error?.message ?? null))
  }

  // SB-10/FA-1: this was the last inline Supabase query outside lib/supabase/
  // in the whole tree, and the only genuine violation the new lint rule found.
  await markEmailVerified(supabase, data.session.user.id)

  if (type === 'recovery') {
    // WS-ACCT-04: the exchange above minted a full session. Mark it as a
    // recovery session so middleware confines it to /update-password until the
    // user actually sets a new password — a reset link must not be a roaming
    // login. The marker is cleared by /api/auth/password-update on success.
    const response = NextResponse.redirect(new URL(ROUTES.auth.updatePassword, origin))
    setRecoveryCookie(response)
    return response
  }

  return NextResponse.redirect(new URL(ROUTES.auth.roleSelect, origin))
}
