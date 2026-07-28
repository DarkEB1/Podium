import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getUser } from '@/lib/supabase/auth'
import { storePushSubscription, deletePushSubscription } from '@/lib/push'

/** Store the caller's Web Push subscription. */
export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const user = await getUser(supabase)
  if (!user) {
    return NextResponse.json({ error: { code: 'UNAUTHENTICATED', message: 'Sign in required' } }, { status: 401 })
  }

  let body: { endpoint?: string; keys?: { p256dh?: string; auth?: string } }
  try {
    body = (await request.json()) as typeof body
  } catch {
    return NextResponse.json({ error: { code: 'INVALID_JSON', message: 'Body must be JSON' } }, { status: 400 })
  }
  const endpoint = body.endpoint
  const p256dh = body.keys?.p256dh
  const auth = body.keys?.auth
  if (!endpoint || !p256dh || !auth) {
    return NextResponse.json({ error: { code: 'MISSING_FIELDS', message: 'endpoint and keys are required' } }, { status: 400 })
  }

  await storePushSubscription(supabase, user.id, { endpoint, p256dh, auth }, request.headers.get('user-agent'))
  return NextResponse.json({ ok: true })
}

/** Remove the caller's subscription for a given endpoint. */
export async function DELETE(request: NextRequest) {
  const supabase = await createClient()
  const user = await getUser(supabase)
  if (!user) {
    return NextResponse.json({ error: { code: 'UNAUTHENTICATED', message: 'Sign in required' } }, { status: 401 })
  }

  let body: { endpoint?: string }
  try {
    body = (await request.json()) as typeof body
  } catch {
    return NextResponse.json({ error: { code: 'INVALID_JSON', message: 'Body must be JSON' } }, { status: 400 })
  }
  if (!body.endpoint) {
    return NextResponse.json({ error: { code: 'MISSING_FIELDS', message: 'endpoint is required' } }, { status: 400 })
  }

  await deletePushSubscription(supabase, user.id, body.endpoint)
  return NextResponse.json({ ok: true })
}
