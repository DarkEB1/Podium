import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getUser } from '@/lib/supabase/auth'
import { completeBrandOnboarding, ProfileError } from '@/lib/supabase/profiles'
import { setOnboardedCookie } from '@/lib/auth/onboarded-cookie'

/**
 * Marks a brand's onboarding wizard as finished (the step 4 "Submit for review"
 * action).
 *
 * Why brands need their own endpoint rather than `/api/profiles/me/publish`:
 * publishing sets `status = 'active'`, and a brand's status is decided by admin
 * review, not by the brand. Before this existed, step 4 only fired a toast and
 * navigated away, nothing was recorded server-side, and the onboarding gate had
 * to guess from `status` — which for brands can never be `'draft'`, so it always
 * guessed "finished" and let brands out of the wizard after step 1.
 *
 * Other roles must not reach this: athlete, team and agent completion is carried
 * by `status`, and giving them a second, contradictory completion marker is how
 * the original bug got in.
 */
export async function POST() {
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
      {
        error: {
          code: 'ROLE_NOT_SUPPORTED',
          message: 'Only brand profiles complete onboarding through this endpoint',
        },
      },
      { status: 400 }
    )
  }

  try {
    await completeBrandOnboarding(supabase, user.id)
    // The brand has finished the wizard (onboarding_completed_at is now set),
    // so cache that for middleware's onboarding gate. See
    // lib/auth/onboarded-cookie.ts.
    const response = NextResponse.json({ success: true })
    setOnboardedCookie(response)
    return response
  } catch (err) {
    if (err instanceof ProfileError) {
      if (err.code === 'PROFILE_NOT_FOUND') {
        return NextResponse.json(
          { error: { code: err.code, message: err.message } },
          { status: 404 }
        )
      }
      // Never let a raw database message reach the browser, and never re-throw:
      // a thrown error here becomes an HTML 500 with no JSON body, which the
      // client cannot parse and therefore reports to the user as nothing at all.
      console.error('[onboarding-complete] failed', err.code, err.message)
      return NextResponse.json(
        {
          error: {
            code: 'ONBOARDING_COMPLETE_FAILED',
            message: 'Could not save your progress. Please try again.',
          },
        },
        { status: 500 }
      )
    }
    throw err
  }
}
