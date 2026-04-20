import { timingSafeEqual } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { getUser } from '@/lib/supabase/auth'
import { getAuditLogs, createAuditLog, AdminError } from '@/lib/supabase/admin'

function verifyServiceRoleKey(token: string | null): boolean {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!token || !serviceRoleKey) return false
  try {
    const tokenBuf = Buffer.from(token)
    const keyBuf = Buffer.from(serviceRoleKey)
    return tokenBuf.length === keyBuf.length && timingSafeEqual(tokenBuf, keyBuf)
  } catch {
    return false
  }
}

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const user = await getUser(supabase)

  if (!user) {
    return NextResponse.json(
      { error: { code: 'UNAUTHENTICATED', message: 'Authentication required' } },
      { status: 401 }
    )
  }

  if (user.role !== 'admin') {
    return NextResponse.json(
      { error: { code: 'FORBIDDEN', message: 'Admin access required' } },
      { status: 403 }
    )
  }

  const { searchParams } = request.nextUrl
  const limitParam = searchParams.get('limit')
  const offsetParam = searchParams.get('offset')
  const limitParsed = limitParam ? parseInt(limitParam, 10) : undefined
  const offsetParsed = offsetParam ? parseInt(offsetParam, 10) : undefined

  if (limitParsed !== undefined && (isNaN(limitParsed) || limitParsed < 1)) {
    return NextResponse.json(
      { error: { code: 'INVALID_PARAM', message: 'limit must be a positive integer' } },
      { status: 400 }
    )
  }

  if (offsetParsed !== undefined && (isNaN(offsetParsed) || offsetParsed < 0)) {
    return NextResponse.json(
      { error: { code: 'INVALID_PARAM', message: 'offset must be a non-negative integer' } },
      { status: 400 }
    )
  }

  const limit = limitParsed
  const offset = offsetParsed
  const adminSupabase = createAdminClient()

  try {
    const logs = await getAuditLogs(adminSupabase, {
      ...(limit !== undefined ? { limit } : {}),
      ...(offset !== undefined ? { offset } : {}),
    })
    return NextResponse.json(logs)
  } catch (err) {
    if (err instanceof AdminError) {
      return NextResponse.json(
        { error: { code: err.code, message: err.message } },
        { status: 500 }
      )
    }
    throw err
  }
}

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('Authorization')
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null

  if (!verifyServiceRoleKey(token)) {
    return NextResponse.json(
      { error: { code: 'UNAUTHENTICATED', message: 'Service role key required' } },
      { status: 401 }
    )
  }

  const body = await request.json()
  const { actor_id, action, target_type, target_id, metadata, ip_address } = body

  if (!action || !target_type || !target_id) {
    return NextResponse.json(
      { error: { code: 'MISSING_FIELDS', message: 'action, target_type, and target_id are required' } },
      { status: 400 }
    )
  }

  const adminSupabase = createAdminClient()

  try {
    const log = await createAuditLog(adminSupabase, {
      action,
      target_type,
      target_id,
      ...(actor_id !== undefined ? { actor_id } : {}),
      ...(metadata !== undefined ? { metadata } : {}),
      ...(ip_address !== undefined ? { ip_address } : {}),
    })
    return NextResponse.json(log, { status: 201 })
  } catch (err) {
    if (err instanceof AdminError) {
      return NextResponse.json(
        { error: { code: err.code, message: err.message } },
        { status: 500 }
      )
    }
    throw err
  }
}
