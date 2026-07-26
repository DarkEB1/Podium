import { NextRequest, NextResponse } from 'next/server'

import { createClient } from '@/lib/supabase/server'
import { getUser } from '@/lib/supabase/auth'
import {
  getIncomingConnectionRequests,
  ConnectionsError,
} from '@/lib/supabase/connections'
import { withRequestContext } from '@/lib/observability'

/**
 * GET /api/discovery/connections/incoming — the connection requests addressed
 * to the signed-in user (their accept/decline queue).
 *
 * Parity with POST /api/discovery/connections (send) and
 * PATCH /api/discovery/connections/[requestId] (respond): the inbox was the one
 * side of the loop with no HTTP surface, so the only way to read it was a page
 * querying Supabase inline. Recipient is ALWAYS the authenticated user — the
 * id is never taken from the request, so this cannot be used to read someone
 * else's inbox even if RLS were misconfigured.
 */

export const dynamic = 'force-dynamic'

const VALID_STATUSES = new Set(['pending', 'accepted', 'declined', 'withdrawn'])
const MAX_LIMIT = 100

export async function GET(request: NextRequest) {
  const obs = withRequestContext({ route: '/api/discovery/connections/incoming', method: 'GET' })

  const supabase = await createClient()
  const user = await getUser(supabase)

  if (!user) {
    return NextResponse.json(
      { error: { code: 'UNAUTHENTICATED', message: 'Authentication required' } },
      { status: 401 }
    )
  }

  const statusParam = request.nextUrl.searchParams.get('status')
  if (statusParam && !VALID_STATUSES.has(statusParam)) {
    return NextResponse.json(
      {
        error: {
          code: 'INVALID_STATUS',
          message: 'status must be pending, accepted, declined, or withdrawn',
        },
      },
      { status: 400 }
    )
  }

  const limitParam = Number(request.nextUrl.searchParams.get('limit'))
  const limit =
    Number.isFinite(limitParam) && limitParam > 0 ? Math.min(limitParam, MAX_LIMIT) : undefined

  try {
    const requests = await getIncomingConnectionRequests(supabase, user.id, {
      // as ConnectionRequestRow['status']: validated against VALID_STATUSES above.
      status: (statusParam ?? undefined) as
        | 'pending'
        | 'accepted'
        | 'declined'
        | 'withdrawn'
        | undefined,
      limit,
    })

    return NextResponse.json({ requests, count: requests.length })
  } catch (err) {
    // Previously this class of failure had nowhere to go (DH-6). The DB message
    // is logged, never returned.
    obs.captureException(err, {
      code: err instanceof ConnectionsError ? err.code : 'UNKNOWN',
    })
    return NextResponse.json(
      {
        error: {
          code: 'INCOMING_REQUESTS_FETCH_FAILED',
          message: 'Could not load your connection requests. Please try again.',
        },
      },
      { status: 500 }
    )
  }
}
