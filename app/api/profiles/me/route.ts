import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getUser } from '@/lib/supabase/auth'
import {
  createProfile,
  getOwnProfile,
  updateProfile,
  ProfileError,
  type ProfileRole,
} from '@/lib/supabase/profiles'

const PROFILE_ROLES = new Set<string>(['athlete', 'team', 'brand', 'agent'])

/**
 * Turns any ProfileError into a real JSON error response.
 *
 * Both write handlers used to re-throw everything except one known code, so a
 * rejected write (a constraint violation, an invalid enum value) produced an
 * empty non-JSON 500. Clients that called `res.json()` on that threw a
 * SyntaxError instead of surfacing the failure, which is how a brand submitting
 * step 1 with no LinkedIn URL got a silent revert and no message.
 *
 * `PROFILE_ALREADY_EXISTS` and `PROFILE_NOT_FOUND` keep their own status codes;
 * everything else is a rejected write, so 400.
 */
const PROFILE_ERROR_STATUS: Record<string, number> = {
  PROFILE_ALREADY_EXISTS: 409,
  PROFILE_NOT_FOUND: 404,
}

/**
 * Codes whose message is written by us and safe to show the user. Anything else
 * carries a raw Postgres message (`null value in column "linkedin_url" of
 * relation "brand_profiles" violates not-null constraint`), which names internal
 * columns and constraints and must not reach the browser. Those are logged
 * server-side and replaced with a generic message, matching how
 * `app/api/discovery/connections` handles the same distinction.
 */
const SAFE_TO_SHOW = new Set(['PROFILE_ALREADY_EXISTS', 'PROFILE_NOT_FOUND'])

function profileErrorResponse(err: unknown): NextResponse | null {
  if (!(err instanceof ProfileError)) return null

  const status = PROFILE_ERROR_STATUS[err.code] ?? 400
  if (SAFE_TO_SHOW.has(err.code)) {
    return NextResponse.json({ error: { code: err.code, message: err.message } }, { status })
  }

  console.error('[profiles/me] write rejected', err.code, err.message)
  return NextResponse.json(
    {
      error: {
        code: err.code,
        message: 'We could not save those details. Please check your entries and try again.',
      },
    },
    { status }
  )
}

/** A malformed body must be a 400 with a JSON envelope, never a thrown HTML 500. */
async function readBody(
  request: NextRequest
): Promise<{ body: Record<string, unknown> } | { response: NextResponse }> {
  try {
    return { body: (await request.json()) as Record<string, unknown> }
  } catch {
    return {
      response: NextResponse.json(
        { error: { code: 'INVALID_JSON', message: 'Request body must be valid JSON' } },
        { status: 400 }
      ),
    }
  }
}

export async function GET() {
  const supabase = await createClient()
  const user = await getUser(supabase)

  if (!user) {
    return NextResponse.json(
      { error: { code: 'UNAUTHENTICATED', message: 'Authentication required' } },
      { status: 401 }
    )
  }

  if (!user.role || !PROFILE_ROLES.has(user.role)) {
    return NextResponse.json(
      { error: { code: 'ROLE_NOT_SET', message: 'Role has not been selected yet' } },
      { status: 400 }
    )
  }

  const profile = await getOwnProfile(supabase, user.id, user.role as ProfileRole)

  if (!profile) {
    return NextResponse.json(
      { error: { code: 'PROFILE_NOT_FOUND', message: 'No profile found for this user' } },
      { status: 404 }
    )
  }

  return NextResponse.json(profile)
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const user = await getUser(supabase)

  if (!user) {
    return NextResponse.json(
      { error: { code: 'UNAUTHENTICATED', message: 'Authentication required' } },
      { status: 401 }
    )
  }

  if (!user.role_locked_at) {
    return NextResponse.json(
      {
        error: {
          code: 'ROLE_NOT_LOCKED',
          message: 'Role must be locked before creating a profile',
        },
      },
      { status: 400 }
    )
  }

  if (!user.role || !PROFILE_ROLES.has(user.role)) {
    return NextResponse.json(
      { error: { code: 'ROLE_NOT_SET', message: 'Role has not been selected yet' } },
      { status: 400 }
    )
  }

  const parsed = await readBody(request)
  if ('response' in parsed) return parsed.response

  try {
    const profile = await createProfile(supabase, user.id, user.role as ProfileRole, parsed.body)
    return NextResponse.json(profile, { status: 201 })
  } catch (err) {
    const response = profileErrorResponse(err)
    if (response) return response
    throw err
  }
}

export async function PATCH(request: NextRequest) {
  const supabase = await createClient()
  const user = await getUser(supabase)

  if (!user) {
    return NextResponse.json(
      { error: { code: 'UNAUTHENTICATED', message: 'Authentication required' } },
      { status: 401 }
    )
  }

  if (!user.role || !PROFILE_ROLES.has(user.role)) {
    return NextResponse.json(
      { error: { code: 'ROLE_NOT_SET', message: 'Role has not been selected yet' } },
      { status: 400 }
    )
  }

  const parsed = await readBody(request)
  if ('response' in parsed) return parsed.response

  try {
    const profile = await updateProfile(supabase, user.id, user.role as ProfileRole, parsed.body)
    return NextResponse.json(profile)
  } catch (err) {
    const response = profileErrorResponse(err)
    if (response) return response
    throw err
  }
}
