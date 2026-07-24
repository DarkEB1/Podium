import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getUser } from '@/lib/supabase/auth'
import {
  getSettings,
  getNotificationMatrix,
  updateNotificationMatrix,
  updateSettings,
  type NotificationMatrix,
} from '@/lib/supabase/settings'
import { isEmailEvent } from '@/lib/email/types'
import { captureException } from '@/lib/observability'

/**
 * Notification preferences (CL-4). GET returns the user's current email
 * preferences; PATCH updates them. This is the surface the "manage email
 * preferences" link in every email footer points at, and the settings UI reads.
 *
 * Runs as the signed-in user (RLS scopes profile_settings to them) — never the
 * admin client. Only the fields a user is allowed to set are accepted.
 */

export const dynamic = 'force-dynamic'

const DIGEST_VALUES = ['daily', 'weekly', 'off'] as const
type Digest = (typeof DIGEST_VALUES)[number]

export async function GET() {
  const supabase = await createClient()
  const user = await getUser(supabase)
  if (!user) {
    return NextResponse.json(
      { error: { code: 'UNAUTHENTICATED', message: 'Authentication required' } },
      { status: 401 }
    )
  }

  try {
    const [settings, matrix] = await Promise.all([
      getSettings(supabase, user.id),
      getNotificationMatrix(supabase, user.id),
    ])
    return NextResponse.json({
      matrix,
      email_digest: settings.email_digest,
      marketing_opt_in: settings.marketing_opt_in,
    })
  } catch (err) {
    captureException(err, { route: '/api/settings/notifications', method: 'GET' })
    return NextResponse.json(
      { error: { code: 'SETTINGS_FETCH_FAILED', message: 'Could not load preferences' } },
      { status: 500 }
    )
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

  let body: {
    emailByEvent?: Record<string, boolean>
    email_digest?: string
    marketing_opt_in?: boolean
  }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { error: { code: 'INVALID_JSON', message: 'Request body must be valid JSON' } },
      { status: 400 }
    )
  }

  try {
    // Per-event email toggles — accept only known catalogue events, so an
    // arbitrary key cannot bloat the matrix.
    if (body.emailByEvent && typeof body.emailByEvent === 'object') {
      const patch: NotificationMatrix = {}
      for (const [event, on] of Object.entries(body.emailByEvent)) {
        if (isEmailEvent(event) && typeof on === 'boolean') {
          patch[event] = { email: on }
        }
      }
      if (Object.keys(patch).length > 0) {
        await updateNotificationMatrix(supabase, user.id, patch)
      }
    }

    // Digest + marketing opt-in.
    const settingsPatch: { email_digest?: Digest; marketing_opt_in?: boolean } = {}
    if (typeof body.email_digest === 'string' && (DIGEST_VALUES as readonly string[]).includes(body.email_digest)) {
      settingsPatch.email_digest = body.email_digest as Digest
    }
    if (typeof body.marketing_opt_in === 'boolean') {
      settingsPatch.marketing_opt_in = body.marketing_opt_in
    }
    if (Object.keys(settingsPatch).length > 0) {
      await updateSettings(supabase, user.id, settingsPatch)
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    captureException(err, { route: '/api/settings/notifications', method: 'PATCH' })
    return NextResponse.json(
      { error: { code: 'SETTINGS_UPDATE_FAILED', message: 'Could not save preferences' } },
      { status: 500 }
    )
  }
}
