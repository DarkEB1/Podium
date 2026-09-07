import { type NextRequest } from 'next/server'
import { runCountingCronJob } from '@/lib/cron/run'

/**
 * WS-LISTING-05: listing expiry sweep.
 *
 * `expire_listings_past_deadline()` (migration 20260720008000) moves listings
 * whose application deadline has passed from `active` to `expired`. It had no
 * caller, so expired listings kept a status of "Active" on the brand dashboard
 * and — with the entitlement gate counting active rows — kept occupying a tier
 * slot that could never be freed.
 *
 * The RPC is bounded, idempotent and reversible; it uses its default limit
 * (500) per run. The discovery feed predicate already hides expired listings,
 * so this only reconciles the stored status column with that predicate.
 */
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

function handle(request: NextRequest) {
  return runCountingCronJob(request, {
    route: '/api/cron/listing-expiry',
    job: 'listing-expiry',
    fn: 'expire_listings_past_deadline',
    resultKey: 'listings_expired',
  })
}

export async function GET(request: NextRequest) {
  return handle(request)
}

export async function POST(request: NextRequest) {
  return handle(request)
}
